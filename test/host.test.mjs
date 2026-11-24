// Drive the Host half's state machine with a fake runtime: fake agents, fake
// jobs, and a subprocess that records argv instead of executing it. Nothing
// here can power the machine off.
import { apply } from '../index.js'

// Deterministic time drives the real interval callback without waiting minutes.
let clock = null
const flush = async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve() }
const sleep = async (ms) => {
  const until = clock.now + ms
  while (clock.next <= until) {
    clock.now = clock.next
    clock.next += 1000
    clock.tick?.()
    await flush()
  }
  clock.now = until
  await flush()
}
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
/** Move the clock forward without letting the interval tick in between. */
const jump = async (ms) => {
  clock.now += ms
  clock.next = clock.now + 1000
  clock.tick?.()
  await flush()
}

// `spawned` is the power command; the keep-awake helper is a process too, and
// mixing them would make every "exactly one command ran" assertion unreadable.
const state = { agents: [], jobs: [], spawned: [], awake: [], awakeStopped: 0 }

const isAwakeHelper = (argv) => argv.some((part) => /SetThreadExecutionState|systemd-inhibit|caffeinate/.test(String(part)))

let failures = 0
function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

const agent = (id, status) => ({ id, status, inbox: { nextTurn: [], nextStep: [] } })
const job = (id, status, owner) => ({ id, status, owner })

/**
 * Build one fake Host context. `overrides` replaces an injected service so a
 * scenario can force a command failure. Cordis exposes injected services as
 * both `ctx.name` properties and `ctx.get(name)`; the plugin uses the property
 * form for `subprocess`, `webServer`, and `logger`, so both must be present.
 */
function makeContext(overrides = {}) {
  const routes = new Map()
  const agents = { list: () => state.agents }
  const jobs = {
    list: (caller) => state.jobs.filter((entry) => entry.owner === undefined || entry.owner === caller),
    events: { subscribe: () => () => {} },
  }
  const connection = { requestRejection: () => undefined }
  const webServer = {
    register(route) {
      routes.set(route.path, route)
      return () => routes.delete(route.path)
    },
  }
  const subprocess = {
    resolveExecutable: async (command) => `C:\\fake\\${command}.exe`,
    spawn: (spec) => {
      if (isAwakeHelper(spec.argv)) {
        state.awake.push(spec.argv)
        return {
          collected: {},
          done: new Promise(() => {}),
          terminate: async () => { state.awakeStopped += 1 },
        }
      }
      state.spawned.push(spec.argv)
      return {
        collected: { stderr: { readFrom: () => ({ text: '' }) } },
        done: Promise.resolve({ exitCode: 0, signal: null }),
      }
    },
    ...overrides.subprocess,
  }
  const byName = { agents, jobs, connection, subprocess, webServer }
  const disposers = []
  const listeners = new Map()
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    agents,
    jobs,
    connection,
    subprocess,
    webServer,
    // Cordis runs the effect body and owns what it returns; calling the body
    // again would leak a second timer, so keep the returned disposer instead.
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return () => {}
    },
    on(event, handler) {
      listeners.set(event, handler)
      return () => listeners.delete(event)
    },
    get(name) {
      return byName[name]
    },
  }
  return {
    ctx,
    routes,
    services: byName,
    emit(event) { listeners.get(event)?.() },
    dispose() {
      for (const dispose of disposers.splice(0)) dispose()
    },
  }
}
/** Invoke a registered route handler with a fake request/response pair. */
function call(routes, path, { method = 'GET', body = '', headers = {}, bodyReady } = {}) {
  const route = routes.get(path)
  if (!route) throw new Error(`no route ${path}`)
  const res = {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(key, value) { this.headers[key.toLowerCase()] = value },
    end(text) { this.body = text ?? '' },
  }
  const req = {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    async *[Symbol.asyncIterator]() {
      if (bodyReady) await bodyReady
      if (body.length > 0) yield Buffer.from(body)
    },
    resume() {},
  }
  return Promise.resolve(route.handler(req, res)).then(() => res)
}

const parse = (res) => {
  try {
    return JSON.parse(res.body)
  } catch {
    return null
  }
}

const readState = async (routes) => parse(await call(routes, '/goodnight/state'))

/**
 * Poll the live state until `predicate` holds. The Host advances on a 1 Hz
 * clock, so tests observe phases instead of assuming a fixed latency.
 */
async function waitFor(routes, predicate, label, timeoutMs = 10000) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    last = await readState(routes)
    if (predicate(last)) return last
    await sleep(100)
  }
  throw new Error(`timed out waiting for ${label}; last state=${JSON.stringify(last)}`)
}

/**
 * Run one scenario against the real state machine.
 *
 * The plugin decides whether it is supported from the platform, so the suite
 * pins it to 'win32' by default. That makes the Windows behaviour testable on
 * Linux and macOS runners too, instead of the whole suite only passing on a
 * Windows machine. The platform is injected through the separate environment
 * argument, never through the user-facing config.
 */
async function scenario(name, config, body, overrides) {
  console.log(`\n=== ${name} ===`)
  state.agents = []
  state.jobs = []
  state.spawned = []
  state.awake = []
  state.awakeStopped = 0
  const runtime = makeContext(overrides)
  const original = { now: Date.now, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval }
  clock = { now: 0, next: 1000, tick: null }
  Date.now = () => clock.now
  globalThis.setInterval = (tick) => { clock.tick = tick; return 1 }
  globalThis.clearInterval = () => { clock.tick = null }
  try {
    apply(runtime.ctx, config, { platform: 'win32' })
    await body(runtime)
  } finally {
    runtime.dispose()
    Date.now = original.now
    globalThis.setInterval = original.setInterval
    globalThis.clearInterval = original.clearInterval
    clock = null
  }
}

/**
 * Run one scenario against a Host on a specific platform. Used for the
 * unsupported-platform behaviour, which must be exercised on every runner.
 */
async function scenarioOnPlatform(name, platform, config, body) {
  console.log(`\n=== ${name} ===`)
  state.agents = []
  state.jobs = []
  state.spawned = []
  state.awake = []
  state.awakeStopped = 0
  const runtime = makeContext()
  const original = { now: Date.now, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval }
  clock = { now: 0, next: 1000, tick: null }
  Date.now = () => clock.now
  globalThis.setInterval = (tick) => { clock.tick = tick; return 1 }
  globalThis.clearInterval = () => { clock.tick = null }
  try {
    apply(runtime.ctx, config, { platform })
    await body(runtime)
  } finally {
    runtime.dispose()
    Date.now = original.now
    globalThis.setInterval = original.setInterval
    globalThis.clearInterval = original.clearInterval
    clock = null
  }
}

// 1. Routes, validation, initial state.
await scenario('routes and initial state', { quietSeconds: 1, countdownSeconds: 6 }, async ({ routes }) => {
  const res = await call(routes, '/goodnight/state')
  const body = parse(res)
  check('GET /state answers 200', res.statusCode === 200, res.statusCode)
  check('phase is idle', body?.phase === 'idle', body?.phase)
  check('platform supported', body?.supported === true, body?.supported)
  check('mode defaults to shutdown', body?.mode === 'shutdown', body?.mode)
  check('countdown config reflected', body?.countdownSeconds === 6, body?.countdownSeconds)
  // quietSeconds below the 3s floor is clamped up, so a typo cannot make the
  // watcher fire during a task handoff.
  check('quiet config clamped to the 3s floor', body?.quietSeconds === 3, body?.quietSeconds)
  check('background defaults to solid', body?.backgroundStyle === 'solid', body?.backgroundStyle)
  check('no-store header set', res.headers['cache-control'] === 'no-store', res.headers['cache-control'])

  check('POST /cancel accepts', (await call(routes, '/goodnight/cancel', { method: 'POST', body: '{}' })).statusCode === 200)
  check('GET /arm is 405', (await call(routes, '/goodnight/arm', { method: 'GET' })).statusCode === 405)
  check('non-JSON /arm is 415', (await call(routes, '/goodnight/arm', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).statusCode === 415)
  check('unknown mode is 400', (await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"explode"}' })).statusCode === 400)
  check('cancel is 405 on GET', (await call(routes, '/goodnight/cancel', { method: 'GET' })).statusCode === 405)

  // The mode route is what makes the sidebar entry name the chosen action.
  const toHibernate = await call(routes, '/goodnight/mode', { method: 'POST', body: '{"mode":"hibernate"}' })
  check('POST /mode accepts hibernate', toHibernate.statusCode === 200, toHibernate.statusCode)
  check('/mode returns the new state', parse(toHibernate)?.mode === 'hibernate', parse(toHibernate)?.mode)
  const backToShutdown = parse(await call(routes, '/goodnight/mode', { method: 'POST', body: '{"mode":"shutdown"}' }))
  check('POST /mode accepts shutdown', backToShutdown?.mode === 'shutdown', backToShutdown?.mode)
  check('state reflects the chosen mode', parse(await call(routes, '/goodnight/state'))?.mode === 'shutdown')
  check('mode rejects an empty body', (await call(routes, '/goodnight/mode', { method: 'POST', body: '' })).statusCode === 400)
  check('mode rejects an unknown mode', (await call(routes, '/goodnight/mode', { method: 'POST', body: '{"mode":"explode"}' })).statusCode === 400)
  check('mode is 405 on GET', (await call(routes, '/goodnight/mode', { method: 'GET' })).statusCode === 405)
  check('mode rejects non-JSON', (await call(routes, '/goodnight/mode', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).statusCode === 415)
})

await scenario('all routes require the connection trust check', {}, async ({ routes, services }) => {
  const paths = ['state', 'arm', 'cancel', 'mode', 'background']
  for (const status of [401, 403]) {
    services.connection = { requestRejection: () => status }
    for (const path of paths) {
      const response = await call(routes, `/goodnight/${path}`, { method: path === 'state' ? 'GET' : 'POST', body: '{}' })
      check(`${path} returns ${status} when the request is rejected`, response.statusCode === status)
    }
  }
  services.connection = undefined
  for (const path of paths) {
    const response = await call(routes, `/goodnight/${path}`, { method: path === 'state' ? 'GET' : 'POST', body: '{}' })
    check(`${path} is unavailable without the connection service`, response.statusCode === 503)
  }
})

await scenario('a stale mode change cannot modify a reservation', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  const body = deferred()
  const pending = call(routes, '/goodnight/mode', { method: 'POST', body: '{"mode":"shutdown"}', bodyReady: body.promise })
  await flush()
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"hibernate"}' })
  body.resolve()
  const stale = await pending
  check('a mode request started before arming is rejected', stale.statusCode === 409 && parse(stale)?.code === 'reservation-changed')
  check('the armed action remains hibernate', (await readState(routes)).mode === 'hibernate')
  await sleep(4000)
  const counting = await call(routes, '/goodnight/mode', { method: 'POST', body: '{"mode":"shutdown"}' })
  check('a mode request during countdown is rejected', counting.statusCode === 409 && parse(counting)?.code === 'reservation-changed')
  check('the countdown action remains hibernate', (await readState(routes)).mode === 'hibernate')
  await sleep(5000)
  check('the original hibernate action executes', state.spawned.length === 1 && state.spawned[0].includes('/h'))
})

await scenario('changing an active mode restarts the quiet window', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"hibernate"}' })
  await sleep(8000)
  check('the original countdown is in progress', (await readState(routes)).phase === 'counting')
  const response = await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"shutdown"}' })
  check('re-arming accepts the new mode', response.statusCode === 200)
  await sleep(3000)
  check('the new mode has not skipped the quiet window', (await readState(routes)).phase === 'armed' && state.spawned.length === 0)
  await sleep(1000)
  check('a full new countdown starts for the new mode', (await readState(routes)).phase === 'counting')
  await sleep(5000)
  check('the new shutdown action executes', state.spawned.length === 1 && state.spawned[0].includes('/s'))
})

// 1b. The background preference is Host-owned, validated, and cosmetic only.
await scenario('background style route', {}, async ({ routes }) => {
  for (const style of ['glass', 'blur', 'solid']) {
    const res = await call(routes, '/goodnight/background', { method: 'POST', body: JSON.stringify({ backgroundStyle: style }) })
    check(`POST /background accepts ${style}`, res.statusCode === 200, res.statusCode)
    check(`/background returns ${style}`, parse(res)?.backgroundStyle === style, parse(res)?.backgroundStyle)
    check(`state persists ${style}`, (await readState(routes)).backgroundStyle === style)
  }
  check('rejects an unknown style', (await call(routes, '/goodnight/background', { method: 'POST', body: '{"backgroundStyle":"neon"}' })).statusCode === 400)
  check('rejects an empty body', (await call(routes, '/goodnight/background', { method: 'POST', body: '' })).statusCode === 400)
  check('rejects a non-object body', (await call(routes, '/goodnight/background', { method: 'POST', body: '"glass"' })).statusCode === 400)
  check('is 405 on GET', (await call(routes, '/goodnight/background', { method: 'GET' })).statusCode === 405)
  check('rejects non-JSON', (await call(routes, '/goodnight/background', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).statusCode === 415)
  check('bad values leave the style unchanged', (await readState(routes)).backgroundStyle === 'solid')
  // A cosmetic write must not disturb the reservation state machine.
  check('still idle after appearance changes', (await readState(routes)).phase === 'idle')
})

await scenario('background config default and validation', { backgroundStyle: 'glass' }, async ({ routes }) => {
  const body = await readState(routes)
  check('configured style is the initial state', body?.backgroundStyle === 'glass', body?.backgroundStyle)
  const res = await call(routes, '/goodnight/background', { method: 'POST', body: '{"backgroundStyle":"blur"}' })
  check('panel can override the config default', parse(res)?.backgroundStyle === 'blur', parse(res)?.backgroundStyle)
})

await scenario('invalid background config falls back to solid', { backgroundStyle: 'transparent' }, async ({ routes }) => {
  check('unknown config value is ignored', (await readState(routes)).backgroundStyle === 'solid')
})

// 1c. The custom solid colour is optional and validated like the style: a hex
// pins the surface, `null` hands the surface back to the Host theme.
await scenario('countdown colour route', {}, async ({ routes }) => {
  check('colour defaults to following the theme', (await readState(routes)).countdownColor === null, (await readState(routes)).countdownColor)
  const set = await call(routes, '/goodnight/color', { method: 'POST', body: '{"color":"#1B2436"}' })
  check('POST /color accepts a hex', set.statusCode === 200, set.statusCode)
  check('the hex is normalised to lower case', parse(set)?.countdownColor === '#1b2436', parse(set)?.countdownColor)
  check('state keeps the colour', (await readState(routes)).countdownColor === '#1b2436')
  // Cosmetic writes must stay out of the reservation state machine.
  check('still idle after a colour change', (await readState(routes)).phase === 'idle')

  const backToTheme = await call(routes, '/goodnight/color', { method: 'POST', body: '{"color":null}' })
  check('null hands the surface back to the theme', parse(backToTheme)?.countdownColor === null, parse(backToTheme)?.countdownColor)

  for (const bad of ['{"color":"red"}', '{"color":"#12345"}', '{"color":"#1234567"}', '{}', '']) {
    check(`rejects ${bad || 'an empty body'}`, (await call(routes, '/goodnight/color', { method: 'POST', body: bad })).statusCode === 400)
  }
  check('rejects a non-JSON body', (await call(routes, '/goodnight/color', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).statusCode === 415)
  check('is 405 on GET', (await call(routes, '/goodnight/color', { method: 'GET' })).statusCode === 405)
  check('bad values leave the colour unchanged', (await readState(routes)).countdownColor === null)
})

await scenario('countdown colour config default', { countdownColor: '#2A1B33' }, async ({ routes }) => {
  check('configured colour is the initial state', (await readState(routes)).countdownColor === '#2a1b33', (await readState(routes)).countdownColor)
  const res = await call(routes, '/goodnight/color', { method: 'POST', body: '{"color":"#14171d"}' })
  check('panel can override the configured colour', parse(res)?.countdownColor === '#14171d', parse(res)?.countdownColor)
})

await scenario('invalid colour config follows the theme', { countdownColor: 'rgb(1,2,3)' }, async ({ routes }) => {
  check('a non-hex config value is ignored', (await readState(routes)).countdownColor === null, (await readState(routes)).countdownColor)
})

// 1d. The waiting phase may take the whole screen too; it is opt-in and the
// route that flips it is cosmetic, like the style and colour routes.
await scenario('fullscreen on wait route', {}, async ({ routes }) => {
  check('waiting fullscreen is off by default', (await readState(routes)).fullscreenOnWait === false, String((await readState(routes)).fullscreenOnWait))
  const on = await call(routes, '/goodnight/fullscreen', { method: 'POST', body: '{"onWait":true}' })
  check('POST /fullscreen accepts true', on.statusCode === 200, on.statusCode)
  check('the snapshot reports it', parse(on)?.fullscreenOnWait === true, String(parse(on)?.fullscreenOnWait))
  check('state keeps it', (await readState(routes)).fullscreenOnWait === true)
  check('still idle after an appearance change', (await readState(routes)).phase === 'idle')
  const off = await call(routes, '/goodnight/fullscreen', { method: 'POST', body: '{"onWait":false}' })
  check('POST /fullscreen accepts false', parse(off)?.fullscreenOnWait === false, String(parse(off)?.fullscreenOnWait))
  for (const bad of ['{"onWait":"yes"}', '{"onWait":1}', '{}', '', '"true"']) {
    check(`rejects ${bad || 'an empty body'}`, (await call(routes, '/goodnight/fullscreen', { method: 'POST', body: bad })).statusCode === 400)
  }
  check('rejects a non-JSON body', (await call(routes, '/goodnight/fullscreen', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).statusCode === 415)
  check('is 405 on GET', (await call(routes, '/goodnight/fullscreen', { method: 'GET' })).statusCode === 405)
})

await scenario('fullscreen on wait config default', { fullscreenOnWait: true }, async ({ routes }) => {
  check('the configured value is the initial state', (await readState(routes)).fullscreenOnWait === true)
})

// 1e. A pending reservation has to keep the machine awake: a sleeping Host cannot
// fire its own countdown, and the lock screen is what an idle display leads to.
await scenario('a reservation holds the machine awake', {}, async ({ routes }) => {
  check('nothing is held before arming', state.awake.length === 0, String(state.awake.length))
  check('stay-awake is on by default', (await readState(routes)).stayAwake === true)
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await flush()
  check('arming starts one helper', state.awake.length === 1, String(state.awake.length))
  const argv = state.awake[0] ?? []
  check('the helper asks Windows for system + display', argv.some((part) => String(part).includes('SetThreadExecutionState')), argv.join(' '))
  check('it asks for continuous no-sleep state', argv.some((part) => String(part).includes('2147483651')), argv.join(' '))
  check('it runs hidden and without a profile', argv.includes('-WindowStyle') && argv.includes('-NoProfile'), argv.join(' '))
  check('no power command was started', state.spawned.length === 0)
  await call(routes, '/goodnight/cancel', { method: 'POST', body: '{}' })
  await flush()
  check('cancelling releases the machine', state.awakeStopped === 1, String(state.awakeStopped))
})

await scenario('a countdown keeps the machine awake until it commits', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await flush()
  check('the helper is running during the quiet window', state.awake.length === 1, String(state.awake.length))
  await sleep(9000)
  await flush()
  check('the command ran', state.spawned.length === 1, String(state.spawned.length))
  check('the helper is released once the command is committed', state.awakeStopped >= 1, String(state.awakeStopped))
})

await scenario('stay-awake can be turned off', { stayAwake: false }, async ({ routes }) => {
  check('the config is reported', (await readState(routes)).stayAwake === false)
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await flush()
  check('no helper is started', state.awake.length === 0, String(state.awake.length))
})

await scenario('stay-awake route', {}, async ({ routes }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await flush()
  check('one helper while the reservation is pending', state.awake.length === 1, String(state.awake.length))
  const off = await call(routes, '/goodnight/awake', { method: 'POST', body: '{"on":false}' })
  check('POST /awake accepts false', off.statusCode === 200, off.statusCode)
  check('the snapshot reports it', parse(off)?.stayAwake === false, String(parse(off)?.stayAwake))
  await flush()
  check('turning it off releases the helper immediately', state.awakeStopped === 1, String(state.awakeStopped))
  const on = await call(routes, '/goodnight/awake', { method: 'POST', body: '{"on":true}' })
  check('POST /awake accepts true', parse(on)?.stayAwake === true, String(parse(on)?.stayAwake))
  await flush()
  check('turning it back on takes it again', state.awake.length === 2, String(state.awake.length))
  for (const bad of ['{"on":"yes"}', '{"on":1}', '{}', '', '"true"']) {
    check(`rejects ${bad || 'an empty body'}`, (await call(routes, '/goodnight/awake', { method: 'POST', body: bad })).statusCode === 400)
  }
  check('rejects a non-JSON body', (await call(routes, '/goodnight/awake', { method: 'POST', body: '{}', headers: { 'content-type': 'text/plain' } })).statusCode === 415)
  check('is 405 on GET', (await call(routes, '/goodnight/awake', { method: 'GET' })).statusCode === 405)
  check('a bad body leaves the setting alone', (await readState(routes)).stayAwake === true)
})

await scenario('fullscreen on wait is refused while executing', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  const completion = deferred()
  ctx.subprocess.spawn = (spec) => { state.spawned.push(spec.argv); return { done: completion.promise, collected: {} } }
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(9000)
  check('command is executing', (await readState(routes)).phase === 'executing')
  const res = await call(routes, '/goodnight/fullscreen', { method: 'POST', body: '{"onWait":true}' })
  check('appearance cannot change after commit', res.statusCode === 409 && parse(res)?.code === 'execution-in-progress', parse(res)?.code)
  completion.resolve()
})

await scenario('background change cannot disturb a pending arm', {}, async ({ routes }) => {
  const body = deferred()
  const pending = call(routes, '/goodnight/arm', { method: 'POST', body: '{}', bodyReady: body.promise })
  await flush()
  await call(routes, '/goodnight/background', { method: 'POST', body: '{"backgroundStyle":"glass"}' })
  body.resolve()
  check('arm still succeeds after an appearance change', (await pending).statusCode === 200)
  check('reservation is armed', (await readState(routes)).phase === 'armed')
  check('appearance change was kept', (await readState(routes)).backgroundStyle === 'glass')
})

await scenario('background change refuses committed execution', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  const completion = deferred()
  ctx.subprocess.spawn = (spec) => {
    state.spawned.push(spec.argv)
    return { done: completion.promise, collected: {} }
  }
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(9000)
  check('command is executing', (await readState(routes)).phase === 'executing')
  const res = await call(routes, '/goodnight/background', { method: 'POST', body: '{"backgroundStyle":"blur"}' })
  check('appearance change returns 409', res.statusCode === 409, res.statusCode)
  check('style is unchanged', (await readState(routes)).backgroundStyle === 'solid')
  completion.resolve({ exitCode: 0 })
  await flush()
})

// 2. Waits for running work, then counts down and executes /h.
await scenario('waits for running work, then hibernates', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  state.agents = [agent('s1', 'running')]
  check('arms despite busy work', (await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"hibernate"}' })).statusCode === 200)

  let snapshot = await readState(routes)
  check('stays armed while busy', snapshot?.phase === 'armed', snapshot?.phase)
  check('reports 1 running agent', snapshot?.busy?.agentsRunning === 1, JSON.stringify(snapshot?.busy))

  await sleep(1500)
  snapshot = await readState(routes)
  check('never counts down while busy', snapshot?.phase === 'armed', snapshot?.phase)
  check('nothing spawned while busy', state.spawned.length === 0, state.spawned.length)

  state.agents = [agent('s1', 'idle')]
  await waitFor(routes, (s) => s?.phase === 'counting', 'countdown to start')
  check('countdown started after the quiet window', true)
  check('nothing spawned during countdown', state.spawned.length === 0, state.spawned.length)

  await waitFor(routes, (s) => s?.lastExecution !== null, 'execution')
  check('spawned exactly one command', state.spawned.length === 1, state.spawned.length)
  const argv = state.spawned[0] ?? []
  check('used /h (hibernate)', argv.includes('/h'), JSON.stringify(argv))
  check('did not use /s', !argv.includes('/s'), JSON.stringify(argv))
  check('used the resolved executable', String(argv[0] ?? '').includes('shutdown'), JSON.stringify(argv))
  snapshot = await readState(routes)
  check('returned to idle after executing', snapshot?.phase === 'idle', snapshot?.phase)
  check('recorded a successful execution', snapshot?.lastExecution?.ok === true, JSON.stringify(snapshot?.lastExecution))
  check('lastExecution names hibernate', snapshot?.lastExecution?.mode === 'hibernate', JSON.stringify(snapshot?.lastExecution))
})

// 3. A new task during the countdown voids it and it never fires.
await scenario('new task voids the countdown', { quietSeconds: 1, countdownSeconds: 8 }, async ({ routes }) => {
  state.agents = [agent('s1', 'idle')]
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"shutdown"}' })
  await waitFor(routes, (s) => s?.phase === 'counting', 'countdown to start')

  state.agents = [agent('s1', 'running')]
  const snapshot = await waitFor(routes, (s) => s?.phase === 'armed', 'countdown to be voided')
  check('countdown voided back to armed', snapshot?.phase === 'armed', snapshot?.phase)
  check('deadline cleared', snapshot?.deadline === null, snapshot?.deadline)

  await sleep(9000)
  check('never executed after being voided', state.spawned.length === 0, state.spawned.length)
})

// 4. Background jobs block the countdown, including session-owned ones.
await scenario('background jobs block the countdown', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  state.agents = [agent('s1', 'idle')]
  state.jobs = [job('bash-1', 'running', 's1')]
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1500)
  let snapshot = await readState(routes)
  check('reports the running job', snapshot?.busy?.jobsRunning === 1, JSON.stringify(snapshot?.busy))
  check('does not count down while the job runs', snapshot?.phase === 'armed', snapshot?.phase)

  state.jobs = [job('bash-1', 'completed', 's1')]
  await waitFor(routes, (s) => s?.lastExecution !== null, 'execution after job settled')
  check('executes once the job settles', state.spawned.length === 1, state.spawned.length)
})

// 5. Queued inbox input counts as pending work.
await scenario('queued inbox input blocks the countdown', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  const busyAgent = agent('s1', 'idle')
  busyAgent.inbox.nextTurn = [{ id: 'm1' }]
  state.agents = [busyAgent]
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1500)
  const snapshot = await readState(routes)
  check('reports 1 queued inbox message', snapshot?.busy?.inboxPending === 1, JSON.stringify(snapshot?.busy))
  check('does not count down with queued input', snapshot?.phase === 'armed', snapshot?.phase)
  check('never executed', state.spawned.length === 0)
})

// 6. A child agent (subagent / workflow child) counts as work.
await scenario('child agents count as work', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  state.agents = [agent('parent', 'idle'), agent('child', 'running')]
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1500)
  const snapshot = await readState(routes)
  check('sees the running child', snapshot?.busy?.agentsRunning === 1, JSON.stringify(snapshot?.busy))
  check('waits for the child', snapshot?.phase === 'armed', snapshot?.phase)
  state.agents = [agent('parent', 'idle'), agent('child', 'idle')]
  await waitFor(routes, (s) => s?.lastExecution !== null, 'execution after child finished')
  check('executes after the child finished', state.spawned.length === 1, state.spawned.length)
})

// 7. Shutdown mode builds the right argv.
await scenario('shutdown mode argv', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  state.agents = [agent('s1', 'idle')]
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"shutdown"}' })
  await waitFor(routes, (s) => s?.lastExecution !== null, 'execution')
  const argv = state.spawned[0] ?? []
  check('used /s', argv.includes('/s'), JSON.stringify(argv))
  check('used /t 0', argv.includes('/t') && argv.includes('0'), JSON.stringify(argv))
  check('used /f', argv.includes('/f'), JSON.stringify(argv))
  check('never used /h', !argv.includes('/h'), JSON.stringify(argv))
})

// 8. Cancel aborts a running countdown.
await scenario('cancel aborts the countdown', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  state.agents = [agent('s1', 'idle')]
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await waitFor(routes, (s) => s?.phase === 'counting', 'countdown to start')
  check('cancel returns 200', (await call(routes, '/goodnight/cancel', { method: 'POST', body: '{}' })).statusCode === 200)
  const snapshot = await readState(routes)
  check('cancel returns to idle', snapshot?.phase === 'idle', snapshot?.phase)
  await sleep(6000)
  check('never executed after cancel', state.spawned.length === 0, state.spawned.length)
})

// 9. A failing command is reported rather than swallowed.
await scenario('command failure is reported', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  state.agents = [agent('s1', 'idle')]
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  const snapshot = await waitFor(routes, (s) => s?.phase === 'failed', 'failure to surface')
  check('phase is failed', snapshot?.phase === 'failed', snapshot?.phase)
  check('error names exit code 1', String(snapshot?.error ?? '').includes('1'), snapshot?.error)
  check('error carries stderr text', String(snapshot?.error ?? '').includes('hibernation is disabled'), snapshot?.error)
  check('lastExecution is marked not ok', snapshot?.lastExecution?.ok === false, JSON.stringify(snapshot?.lastExecution))
}, {
  subprocess: {
    spawn: () => ({
      collected: { stderr: { readFrom: () => ({ text: 'hibernation is disabled' }) } },
      done: Promise.resolve({ exitCode: 1, signal: null }),
    }),
  },
})

// 10. An unresolvable command refuses to arm, so nothing silently does nothing.
await scenario('unresolvable command refuses to arm', { quietSeconds: 1, countdownSeconds: 5 }, async ({ routes }) => {
  state.agents = [agent('s1', 'idle')]
  const res = await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  check('arm is refused with 409', res.statusCode === 409, res.statusCode)
  const body = parse(res)
  check('refusal names the reason', body?.code === 'command-unavailable', JSON.stringify(body))
  const snapshot = await readState(routes)
  check('stays idle after a refused arm', snapshot?.phase === 'idle', snapshot?.phase)
}, {
  subprocess: {
    resolveExecutable: async () => {
      throw new Error('command "shutdown" was not found on PATH')
    },
  },
})

// 11. A non-Windows Host refuses to arm rather than pretending to work.
await scenarioOnPlatform('non-Windows refuses to arm', 'linux', {}, async ({ routes }) => {
  const snapshot = await readState(routes)
  check('reports the platform as unsupported', snapshot?.supported === false, snapshot?.supported)
  check('reports the running platform', snapshot?.platform === 'linux', snapshot?.platform)

  const res = await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"shutdown"}' })
  check('arm is refused with 409', res.statusCode === 409, res.statusCode)
  check('refusal names the reason', parse(res)?.code === 'unsupported-platform', JSON.stringify(parse(res)))
  check('the refusal names the platform', String(parse(res)?.message ?? '').includes('linux'), parse(res)?.message)

  // Nothing may run on a platform with no power backend, however long the
  // reservation is left alone.
  await sleep(6000)
  check('never spawned a power command', state.spawned.length === 0, state.spawned.length)
  check('stays idle', (await readState(routes)).phase === 'idle')

  // The read-only surface still works: an unsupported Host must be inspectable.
  check('the mode route still answers', (await call(routes, '/goodnight/mode', { method: 'POST', body: '{"mode":"hibernate"}' })).statusCode === 200)
  check('the background route still answers', (await call(routes, '/goodnight/background', { method: 'POST', body: '{"backgroundStyle":"glass"}' })).statusCode === 200)
  check('cancel still answers', (await call(routes, '/goodnight/cancel', { method: 'POST', body: '{}' })).statusCode === 200)
})

await scenarioOnPlatform('every non-Windows platform is refused', 'darwin', {}, async ({ routes }) => {
  const res = await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  check('darwin is refused too', res.statusCode === 409 && parse(res)?.code === 'unsupported-platform', JSON.stringify(parse(res)))
  check('reports darwin', (await readState(routes)).platform === 'darwin')
  await sleep(3000)
  check('nothing was spawned on darwin', state.spawned.length === 0)
})

await scenarioOnPlatform('the reported platform follows the Host', 'freebsd', {}, async ({ routes }) => {
  check('the platform is echoed verbatim', (await readState(routes)).platform === 'freebsd')
})

// The platform must not be reachable from the user-facing configuration: a
// stray `platform:` key in cordis.patch.yml must not disable the plugin.
await scenario('the user config cannot override the platform', { platform: 'linux' }, async ({ routes }) => {
  const snapshot = await readState(routes)
  check('a config platform key is ignored', snapshot?.platform === 'win32', snapshot?.platform)
  check('the Host stays supported', snapshot?.supported === true, snapshot?.supported)
})

await scenario('cancel wins while arm request body is still arriving', {}, async ({ routes }) => {
  const body = deferred()
  const pending = call(routes, '/goodnight/arm', { method: 'POST', body: '{}', bodyReady: body.promise })
  await flush()
  await call(routes, '/goodnight/cancel', { method: 'POST' })
  body.resolve()
  check('slow arm body cannot undo cancel', (await pending).statusCode === 409 && (await readState(routes)).phase === 'idle')
})

await scenario('cancel wins over pending arm validation', {}, async ({ routes, ctx }) => {
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  const pending = call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await flush()
  await call(routes, '/goodnight/cancel', { method: 'POST' })
  lookup.resolve('C:\\fake\\shutdown.exe')
  const result = await pending
  check('superseded arm returns conflict', result.statusCode === 409)
  check('cancelled arm stays idle', (await readState(routes)).phase === 'idle')
})

await scenario('work arriving during executable lookup prevents execution', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  await sleep(9000)
  state.agents = [agent('late', 'running')]
  lookup.resolve('C:\\fake\\shutdown.exe')
  await flush()
  check('late work blocks spawn after lookup', state.spawned.length === 0)
  check('late work re-arms watch', (await readState(routes)).phase === 'armed')
})

await scenario('commands cannot claim success once execution is committed', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  const completion = deferred()
  ctx.subprocess.spawn = (spec) => {
    state.spawned.push(spec.argv)
    return { done: completion.promise, collected: {} }
  }
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(9000)
  check('command is executing', (await readState(routes)).phase === 'executing')
  for (const route of ['cancel', 'arm', 'mode']) {
    const response = await call(routes, `/goodnight/${route}`, { method: 'POST', body: '{"mode":"hibernate"}' })
    check(`${route} refuses committed execution`, response.statusCode === 409)
    check(`${route} leaves phase executing`, (await readState(routes)).phase === 'executing')
  }
  check('mode stays the actual executing action', (await readState(routes)).mode === 'shutdown')
  completion.resolve({ exitCode: 0 })
  await flush()
})

await scenario('busy countdown restarts the complete quiet window', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, emit }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(4000)
  state.agents = [agent('s1', 'running')]
  emit('agent/status')
  check('busy state clears quiet time', (await readState(routes)).quietRemainingSeconds === 0)
  await sleep(900)
  state.agents = []
  emit('agent/status')
  await sleep(2100)
  check('does not reuse time spent busy', (await readState(routes)).phase === 'armed')
  await sleep(1000)
  check('starts countdown after a full quiet window', (await readState(routes)).phase === 'counting')
})

await scenario('missing registry cannot look idle', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, services }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(4000)
  const registry = services.agents
  services.agents = undefined
  await sleep(10000)
  check('registry loss prevents execution', state.spawned.length === 0)
  check('registry loss clears countdown', (await readState(routes)).phase === 'armed')
  services.agents = registry
  await sleep(3000)
  check('registry restoration requires fresh quiet period', (await readState(routes)).phase === 'armed')
})

await scenario('latest arm wins out-of-order executable checks', {}, async ({ routes, ctx }) => {
  const first = deferred()
  const second = deferred()
  let calls = 0
  ctx.subprocess.resolveExecutable = () => (++calls === 1 ? first.promise : second.promise)
  const older = call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"shutdown"}' })
  await flush()
  const newer = call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"hibernate"}' })
  await flush()
  second.resolve('C:\\fake\\shutdown.exe')
  check('latest arm succeeds', (await newer).statusCode === 200)
  first.resolve('C:\\fake\\shutdown.exe')
  check('older arm is superseded', (await older).statusCode === 409)
  check('older completion cannot replace chosen action', (await readState(routes)).mode === 'hibernate')
})

await scenario('registry is rechecked after arm lookup', {}, async ({ routes, ctx, services }) => {
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  const pending = call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await flush()
  services.agents = undefined
  lookup.resolve('C:\\fake\\shutdown.exe')
  const result = await pending
  check('arm refuses registry lost during lookup', result.statusCode === 409 && parse(result).code === 'agents-unavailable')
  check('state explicitly marks missing registry', (await readState(routes)).busy.available === false)
})

for (const interruption of ['cancel', 'dispose', 'activity']) {
  await scenario(`${interruption} invalidates an in-flight execution lookup`, { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx, dispose, emit }) => {
    await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
    const lookup = deferred()
    ctx.subprocess.resolveExecutable = () => lookup.promise
    await sleep(9000)
    if (interruption === 'cancel') {
      check('lookup can still be cancelled', (await call(routes, '/goodnight/cancel', { method: 'POST' })).statusCode === 200)
    } else if (interruption === 'dispose') {
      dispose()
    } else {
      state.agents = [agent('brief', 'running')]
      emit('agent/status')
      state.agents = []
      emit('agent/status')
    }
    lookup.resolve('C:\\fake\\shutdown.exe')
    await flush()
    check(`${interruption} prevents stale spawn`, state.spawned.length === 0)
    if (interruption === 'cancel') check('cancel remains idle after lookup', (await readState(routes)).phase === 'idle')
    if (interruption === 'activity') check('brief activity requires new quiet window', (await readState(routes)).phase === 'armed')
  })
}

await scenario('stale lookup failure cannot overwrite cancellation', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  await sleep(9000)
  await call(routes, '/goodnight/cancel', { method: 'POST' })
  lookup.reject(new Error('lookup failed after cancellation'))
  await flush()
  const snapshot = await readState(routes)
  check('stale failure leaves cancellation intact', snapshot.phase === 'idle' && snapshot.error === null && snapshot.lastExecution === null)
})

await scenario('waking long past the deadline re-arms instead of shutting down', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(4000)
  check('the countdown is running before the suspend', (await readState(routes)).phase === 'counting')
  // A laptop sleeping through the whole window: one tick arrives 15 s late.
  await jump(15000)
  check('a late tick does not spawn', state.spawned.length === 0)
  check('the watch is re-armed after a suspend', (await readState(routes)).phase === 'armed')
  await sleep(4000)
  check('the full quiet window must happen again', (await readState(routes)).phase === 'counting')
})

await scenario('a timely execution lookup still runs the reserved action', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"hibernate"}' })
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  await sleep(9000)
  clock.now += 4999
  lookup.resolve('C:\\fake\\shutdown.exe')
  await flush()
  check('a lookup within the resume gap executes once', state.spawned.length === 1 && state.spawned[0].includes('/h'))
})

await scenario('waking during the execution lookup restarts the quiet window', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  await sleep(9000)
  clock.now += 15000
  clock.next = clock.now + 1000
  lookup.resolve('C:\\fake\\shutdown.exe')
  await flush()
  check('resolving a stale lookup cannot spawn the power command', state.spawned.length === 0)
  check('the watch returns to the quiet window', (await readState(routes)).phase === 'armed')
  await sleep(2000)
  check('the watch does not skip the quiet window', (await readState(routes)).phase === 'armed')
  await sleep(1000)
  check('a new countdown follows the complete quiet window', (await readState(routes)).phase === 'counting')
})

await scenario('a frozen blocker can be skipped on request', { quietSeconds: 3, countdownSeconds: 5, stuckAfterSeconds: 30 }, async ({ routes }) => {
  // One job that never settles is exactly the shape of the overnight hang: the
  // quiet window can never start, so the reservation would sit there for ever.
  state.jobs.push({ id: 'job-1', owner: undefined, status: 'running' })
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1000)
  check('the panel is blocked', (await readState(routes)).phase === 'armed')
  check('the blocker is counted', (await readState(routes)).busy.total === 1)
  check('the stuck threshold reaches the panel', (await readState(routes)).stuckAfterSeconds === 30)

  const early = await readState(routes)
  check('the clock starts at zero', early.blockedForSeconds === 0, String(early.blockedForSeconds))
  clock.now += 29_000
  await sleep(1000)
  check('it counts up while the blocker stays', (await readState(routes)).blockedForSeconds >= 29, String((await readState(routes)).blockedForSeconds))

  // A different blocker is new information, so the clock has to restart.
  state.jobs.push({ id: 'job-2', owner: undefined, status: 'running' })
  await sleep(1000)
  check('a changed blocker restarts the clock', (await readState(routes)).blockedForSeconds === 0, String((await readState(routes)).blockedForSeconds))

  clock.now += 40_000
  await sleep(1000)
  const forced = await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  check('POST /force accepts', forced.statusCode === 200, forced.statusCode)
  check('it starts the countdown', parse(forced)?.phase === 'counting', parse(forced)?.phase)
  check('the deadline is a full countdown away', parse(forced)?.remainingSeconds > 0)
  check('no power command runs yet', state.spawned.length === 0)

  // The countdown still voids itself if work is genuinely still moving.
  state.jobs.length = 0
  await sleep(1000)
  check('the countdown survives a settled blocker', (await readState(routes)).phase === 'counting')
})

await scenario('force refuses everything that is not a blocked reservation', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  const idle = await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  check('idle /force is 409', idle.statusCode === 409, idle.statusCode)
  check('it names the reason', parse(idle)?.code === 'not-waiting', parse(idle)?.code)

  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  const unblocked = await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  check('an unblocked wait cannot be forced', unblocked.statusCode === 409, unblocked.statusCode)
  check('it says nothing is blocking', parse(unblocked)?.code === 'not-blocked', parse(unblocked)?.code)

  check('GET /force is 405', (await call(routes, '/goodnight/force', { method: 'GET' })).statusCode === 405)
  check('force never armed on its own', (await readState(routes)).phase === 'armed')
})

await scenario('forced countdown executes while the frozen blocker stays unchanged', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  state.jobs.push(job('job-1', 'running'))
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{"mode":"hibernate"}' })
  await sleep(1000)
  const forced = await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  check('force enters counting', forced.statusCode === 200 && parse(forced)?.phase === 'counting')
  await sleep(3000)
  const mid = await readState(routes)
  check('unchanged blocker stays in counting across ticks', mid.phase === 'counting' && mid.busy.total === 1 && state.spawned.length === 0)
  await sleep(2000)
  check('forced countdown executes at deadline', state.spawned.length === 1 && state.spawned[0].includes('/h'))
  const done = await readState(routes)
  check('phase returns to idle with ok execution', done.phase === 'idle' && done.lastExecution?.ok === true)
})

await scenario('forced countdown completes when one of two frozen jobs finishes', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  state.jobs.push(job('job-1', 'running'), job('job-2', 'running'))
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1000)
  await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  await sleep(1000)
  state.jobs = [job('job-1', 'running')]
  await sleep(4000)
  check('countdown completes with surviving frozen job', state.spawned.length === 1 && (await readState(routes)).phase === 'idle')
})

await scenario('forced countdown shrinks baseline so a restarted job voids it', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  state.jobs.push(job('job-1', 'running'), job('job-2', 'running'))
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1000)
  await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  await sleep(1000)
  state.jobs = [job('job-1', 'running')]
  await sleep(1000)
  check('countdown continues after job-2 finishes', (await readState(routes)).phase === 'counting')
  state.jobs = [job('job-1', 'running'), job('job-2', 'running')]
  await sleep(1000)
  check('restarted job-2 voids forced countdown', (await readState(routes)).phase === 'armed' && (await readState(routes)).deadline === null)
  await sleep(10000)
  check('voided countdown does not execute', state.spawned.length === 0)
})

await scenario('forced countdown voids on new, replaced, agent, inbox, or registry-loss activity', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, services }) => {
  const cases = [
    {
      label: 'new job',
      setup: () => { state.jobs = [job('job-1', 'running')]; state.agents = [] },
      mutate: () => { state.jobs.push(job('job-2', 'running')) },
    },
    {
      label: 'replaced job at same count',
      setup: () => { state.jobs = [job('job-1', 'running')]; state.agents = [] },
      mutate: () => { state.jobs = [job('job-2', 'running')] },
    },
    {
      label: 'running agent',
      setup: () => { state.jobs = [job('job-1', 'running')]; state.agents = [agent('a1', 'idle')] },
      mutate: () => { state.agents = [agent('a1', 'running')] },
    },
    {
      label: 'new identified inbox item',
      setup: () => {
        state.jobs = []
        state.agents = [{ id: 'a1', status: 'idle', inbox: { nextTurn: [{ id: 'msg-1' }], nextStep: [] } }]
      },
      mutate: () => {
        state.agents = [{ id: 'a1', status: 'idle', inbox: { nextTurn: [{ id: 'msg-2' }], nextStep: [] } }]
      },
    },
    {
      label: 'new unidentified inbox item',
      setup: () => {
        state.jobs = []
        state.agents = [{ id: 'a1', status: 'idle', inbox: { nextTurn: [{ text: 'old' }], nextStep: [] } }]
      },
      mutate: () => {
        state.agents = [{ id: 'a1', status: 'idle', inbox: { nextTurn: [{ text: 'old' }, { text: 'new' }], nextStep: [] } }]
      },
    },
    {
      label: 'registry loss during snapshot force',
      setup: () => { state.jobs = [job('job-1', 'running')]; state.agents = [] },
      mutate: () => { services.agents = undefined },
    },
  ]

  const registry = services.agents
  for (const entry of cases) {
    services.agents = registry
    await call(routes, '/goodnight/cancel', { method: 'POST' })
    entry.setup()
    await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
    await sleep(1000)
    const forced = await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
    check(`${entry.label}: force starts counting`, forced.statusCode === 200 && parse(forced)?.phase === 'counting')
    await sleep(1000)
    entry.mutate()
    await sleep(1000)
    const after = await readState(routes)
    check(`${entry.label}: voids back to armed`, after.phase === 'armed' && after.deadline === null && state.spawned.length === 0)
  }
  services.agents = registry
})

await scenario('forced countdown while registry is unavailable executes if registry stays down', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, services }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  services.agents = undefined
  await sleep(1000)
  const forced = await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  check('force accepts unavailable registry', forced.statusCode === 200 && parse(forced)?.phase === 'counting')
  await sleep(5000)
  check('executes when registry stays unavailable', state.spawned.length === 1 && (await readState(routes)).phase === 'idle')
})

await scenario('forced countdown while registry is unavailable executes if registry returns empty', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, services }) => {
  const registry = services.agents
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  services.agents = undefined
  await sleep(1000)
  await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  await sleep(1000)
  services.agents = registry
  await sleep(4000)
  check('executes after registry returns with zero tasks', state.spawned.length === 1 && (await readState(routes)).phase === 'idle')
})

await scenario('forced countdown after registry returns empty voids if a task appears later', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, services }) => {
  const registry = services.agents
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  services.agents = undefined
  await sleep(1000)
  await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  await sleep(1000)
  services.agents = registry
  await sleep(1000)
  check('still counting after empty registry restoration', (await readState(routes)).phase === 'counting')
  state.jobs.push(job('late-job', 'running'))
  await sleep(1000)
  check('task appearing after clear voids countdown', (await readState(routes)).phase === 'armed' && state.spawned.length === 0)
})

await scenario('forced countdown while registry is unavailable voids if registry returns with live tasks', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, services }) => {
  const registry = services.agents
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  services.agents = undefined
  await sleep(1000)
  await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  await sleep(1000)
  state.jobs.push(job('live-job', 'running'))
  services.agents = registry
  await sleep(1000)
  check('returning registry with active work voids countdown', (await readState(routes)).phase === 'armed' && state.spawned.length === 0)
})

await scenario('blockedForSeconds restarts when a job is replaced by a different id at the same count', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes }) => {
  state.jobs.push(job('job-1', 'running'))
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1000)
  clock.now += 25_000
  await sleep(1000)
  check('accumulates while job-1 persists', (await readState(routes)).blockedForSeconds >= 25)
  state.jobs = [job('job-2', 'running')]
  await sleep(1000)
  check('restarts to zero when job-1 is replaced by job-2', (await readState(routes)).blockedForSeconds === 0)
  clock.now += 10_000
  await sleep(1000)
  check('counts up again for job-2', (await readState(routes)).blockedForSeconds >= 10)
})

await scenario('missing registry accumulates blockedForSeconds while armed', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, services }) => {
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  services.agents = undefined
  await sleep(1000)
  check('starts at zero on first missing-registry observation', (await readState(routes)).blockedForSeconds === 0)
  clock.now += 35_000
  await sleep(1000)
  const snapshot = await readState(routes)
  check('missing registry reports non-zero blockedForSeconds', snapshot.busy.available === false && snapshot.blockedForSeconds >= 35, String(snapshot.blockedForSeconds))
})

await scenario('forced execute allows spawn when blocker is unchanged during lookup', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  state.jobs.push(job('job-1', 'running'))
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1000)
  await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  await sleep(5000)
  lookup.resolve('C:\\fake\\shutdown.exe')
  await flush()
  check('unchanged forced blocker still allows spawn after lookup', state.spawned.length === 1 && (await readState(routes)).phase === 'idle')
})

await scenario('forced execute aborts spawn if a new job arrives during lookup', { quietSeconds: 3, countdownSeconds: 5 }, async ({ routes, ctx }) => {
  state.jobs.push(job('job-1', 'running'))
  await call(routes, '/goodnight/arm', { method: 'POST', body: '{}' })
  await sleep(1000)
  await call(routes, '/goodnight/force', { method: 'POST', body: '{}' })
  const lookup = deferred()
  ctx.subprocess.resolveExecutable = () => lookup.promise
  await sleep(5000)
  state.jobs.push(job('job-2', 'running'))
  lookup.resolve('C:\\fake\\shutdown.exe')
  await flush()
  check('new job during lookup prevents spawn', state.spawned.length === 0)
  check('new job during lookup voids back to armed', (await readState(routes)).phase === 'armed')
})

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
process.exit(failures === 0 ? 0 : 1)
