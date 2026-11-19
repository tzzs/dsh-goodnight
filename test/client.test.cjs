// Render the Client half's components with a minimal React stand-in to prove
// each render path produces the expected tree. Hook state is keyed per
// component instance so components cannot leak state into each other, which is
// what a real React tree guarantees. This does not replace looking at the real
// page; it catches crashes and wrong branch selection.
const fs = require('node:fs')
const vm = require('node:vm')

const source = fs.readFileSync(process.argv[2] ?? require('node:path').join(__dirname, '..', 'client.js'), 'utf8')

// --- hook runtime ---------------------------------------------------------
let cursor = 0
let slots = []

function beginComponent() {
  cursor = 0
  slots = []
}

const React = {
  createElement(type, props, ...children) {
    return { type, props: props || {}, children: children.flat(Infinity).filter((c) => c !== undefined) }
  },
  useState(init) {
    const i = cursor++
    if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init
    return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
  },
  useEffect(fn) { cursor++; const cleanup = fn(); return typeof cleanup === 'function' ? cleanup : undefined },
  useCallback(fn) { cursor++; return fn },
  useMemo(fn) { cursor++; return fn() },
  useRef(v) { cursor++; return { current: v } },
}

const requireStub = (spec) => {
  if (spec === 'react') return React
  throw new Error('unexpected require: ' + spec)
}

let factory = null
const listeners = { keydown: [], pointerdown: [] }
const windowStub = {
  __ModuleLoader__: { load: (entry) => { factory = entry.factory } },
  addEventListener(type, fn) { (listeners[type] ??= []).push(fn) },
  removeEventListener(type, fn) {
    const list = listeners[type]
    if (list === undefined) return
    const at = list.indexOf(fn)
    if (at >= 0) list.splice(at, 1)
  },
  innerWidth: 1440,
  innerHeight: 900,
}
/** Fire every captured listener of one type with a synthetic event. */
function fire(type, event) {
  for (const fn of [...(listeners[type] ?? [])]) fn(event)
}
const documentStub = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, remove() {} }),
  head: { appendChild() {} },
}
const fetchStub = async () => ({ ok: true, status: 200, json: async () => ({}) })

const context = vm.createContext({
  window: windowStub,
  document: documentStub,
  fetch: fetchStub,
  console,
  setInterval: () => 1,
  clearInterval() {},
  setTimeout: () => 1,
  clearTimeout() {},
  Date,
  JSON,
})
vm.runInContext(source, context, { filename: 'client.js' })
const moduleObj = factory(requireStub)

// --- capture the plugin's registrations ----------------------------------
const registered = []
const ctx = {
  effect(fn) { const d = fn(); if (typeof d === 'function') d(); return () => {} },
  get: () => undefined,
  locale: { register: () => () => {}, bind: () => (key) => `t(${key})` },
  slots: {
    inject(name, callback) { callback(); return () => {} },
    register(options, component) {
      registered.push({
        name: options.name,
        id: options.id,
        key: options.key,
        order: options.order,
        label: options.label,
        component,
        inject: options.inject,
      })
      return () => {}
    },
  },
}
moduleObj.apply(ctx)


/** Render one element tree, invoking function components with fresh hooks. */
function renderNode(node) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return { kind: 'text', text: String(node) }
  if (Array.isArray(node)) return node.map(renderNode).filter(Boolean)
  if (typeof node.type === 'function') {
    beginComponent()
    return renderNode(node.type({ ...node.props, children: node.children }))
  }
  const element = {
    kind: 'element',
    tag: node.type,
    props: node.props,
    children: node.children.map(renderNode).filter(Boolean),
    /** Support the `contains` check an outside-press handler relies on. */
    contains(target) {
      if (target === element) return true
      const seek = (candidate) => {
        if (candidate === null || candidate === undefined) return false
        if (Array.isArray(candidate)) return candidate.some(seek)
        if (candidate === target) return true
        return candidate.kind === 'element' ? candidate.children.some(seek) : false
      }
      return seek(element.children)
    },
  }
  // A real DOM node is reachable through a ref prop; mirror that so ref-based
  // logic runs in tests the way it does in the app.
  if (node.props.ref !== undefined && node.props.ref !== null && typeof node.props.ref === 'object') {
    node.props.ref.current = element
  }
  return element
}

/** Depth-first collect text from a rendered tree. */
function textsOf(tree, out = []) {
  if (tree === null) return out
  if (Array.isArray(tree)) { for (const child of tree) textsOf(child, out); return out }
  if (tree.kind === 'text') { out.push(tree.text); return out }
  for (const child of tree.children) textsOf(child, out)
  return out
}

/** Depth-first collect class names and tags from a rendered tree. */
function classesOf(tree, out = []) {
  if (tree === null) return out
  if (Array.isArray(tree)) { for (const child of tree) classesOf(child, out); return out }
  if (tree.kind !== 'element') return out
  if (typeof tree.props.className === 'string') out.push(tree.props.className)
  for (const child of tree.children) classesOf(child, out)
  return out
}

/** Find the first rendered element whose tag or class matches. */
function findElement(tree, predicate) {
  if (tree === null) return undefined
  if (Array.isArray(tree)) {
    for (const child of tree) { const hit = findElement(child, predicate); if (hit !== undefined) return hit }
    return undefined
  }
  if (tree.kind !== 'element') return undefined
  if (predicate(tree)) return tree
  for (const child of tree.children) { const hit = findElement(child, predicate); if (hit !== undefined) return hit }
  return undefined
}

const baseState = {
  supported: true,
  platform: 'win32',
  phase: 'idle',
  mode: 'hibernate',
  backgroundStyle: 'solid',
  countdownSeconds: 60,
  quietSeconds: 20,
  remainingSeconds: 0,
  quietRemainingSeconds: 0,
  deadline: null,
  busy: { agentsRunning: 0, inboxPending: 0, jobsRunning: 0, total: 0 },
  error: null,
  lastExecution: null,
}

let failures = 0
function check(label, condition, detail) {
  if (condition) console.log(`  PASS  ${label}`)
  else { failures += 1; console.log(`  FAIL  ${label}${detail === undefined ? '' : ` — ${detail}`}`) }
}

const byId = (id) => registered.find((entry) => entry.id === id)
const byKey = (key) => registered.find((entry) => entry.key === key)

/** Render one registered entry with its injected props. */
function renderEntry(entry, storeValue, actions = {}, ownerProps = {}) {
  const props = {
    usePower: (selector) => (selector ? selector(storeValue) : storeValue),
    t: (key) => key,
    arm: async () => true,
    cancel: async () => true,
    setMode: async () => true,
    setBackground: async () => true,
    refresh: async () => true,
    ...ownerProps,
    ...actions,
  }
  beginComponent()
  const root = entry.component(props)
  return { root, tree: renderNode(root) }
}

const rail = byId('idle-power')
const page = byKey('idle-power')
const countdown = byId('dsh-idle-power.countdown')

console.log('=== registrations ===')
for (const entry of registered) console.log(' ', entry.name, '|', entry.id ?? entry.key ?? '')
check('rail entry registered', rail?.name === 'sidebar.panellist', rail?.name)
check('rail entry sits directly under 自动化任务 (order 15)', rail?.order === 15, String(rail?.order))
check('rail entry exposes a label', rail?.label?.() === 't(rail.label)', String(rail?.label?.()))
check('rail entry can receive the live store', typeof rail?.inject?.()?.hooks?.power?.getSnapshot === 'function')
check('page registered in main', page?.name === 'main', page?.name)
check('page key matches the rail id', page?.key === 'idle-power', page?.key)
// Drift guard: whatever the page destructures must be injected, so a new
// action can never be rendered without the prop that makes it work.
const pageActions = (/function PowerPage\(\{([\s\S]*?)\}\)/.exec(String(page?.component))?.[1] ?? '')
  .split(',')
  .map((part) => part.trim().split(':')[0].trim())
  .filter((name) => name !== '' && name !== 'usePower' && name !== 't')
check('the page destructures at least the known actions', pageActions.length >= 7, String(pageActions.length))
check('page receives every action it destructures', pageActions.every((name) => typeof page?.inject?.()[name] === 'function'), pageActions.join(','))
check('countdown registered in shell.overlay', countdown?.name === 'shell.overlay', countdown?.name)

/** Depth-first visit of rendered elements. */
function walkElements(tree, visit) {
  if (tree === null || tree === undefined) return
  if (Array.isArray(tree)) { for (const child of tree) walkElements(child, visit); return }
  if (tree.kind !== 'element') return
  visit(tree)
  for (const child of tree.children) walkElements(child, visit)
}
const rolesOf = (tree, role) => {
  const found = []
  walkElements(tree, (node) => { if (node.props.role === role) found.push(node) })
  return found
}
const byClass = (tree, name) => findElement(tree, (node) => typeof node.props.className === 'string' && node.props.className.includes(name))
const countClass = (tree, name) => {
  let total = 0
  walkElements(tree, (node) => { if (typeof node.props.className === 'string' && node.props.className.split(' ').includes(name)) total += 1 })
  return total
}
const pageState = (data, extra = {}) => ({ data, ready: true, offline: false, busy: false, note: null, ...extra })
const bgOptions = (tree) => {
  const found = []
  walkElements(tree, (node) => { if (node.props.className === 'ipa-preset') found.push(node) })
  return found
}
/** Every native radio input in the tree, in source order. */
const radiosOf = (tree) => {
  const found = []
  walkElements(tree, (node) => { if (node.tag === 'input' && node.props.type === 'radio') found.push(node) })
  return found
}
/** The native control inside a choice card / preset label. */
const inputOf = (label) => (label === undefined ? undefined : label.children.find((child) => child !== null && child !== undefined && child.kind === 'element' && child.tag === 'input'))
/** Mode radios only: the page also has one radio per background preset. */
const modeRadiosOf = (tree) => radiosOf(tree).filter((node) => node.props.name === 'ipa-mode')
const presetDisabled = (tree) => bgOptions(tree).map((label) => inputOf(label)?.props.disabled)

console.log('\n=== rail glyph: the only always-visible signal ===')
{
  const idle = renderEntry(rail, { data: baseState, offline: false })
  const idleSvg = findElement(idle.tree, (n) => n.tag === 'svg')
  check('renders an svg glyph', idleSvg !== undefined)
  check('exposes the phase for styling', idleSvg?.props['data-phase'] === 'idle', idleSvg?.props['data-phase'])
  check('no pending dot while idle', !classesOf(idle.tree).some((c) => c.includes('ipa-railDot')), classesOf(idle.tree).join(','))
  check('defaults to the rail glyph size', idleSvg?.props.width === 18, String(idleSvg?.props.width))
  check('idle stroke is the thin rail weight', idleSvg?.props.strokeWidth === 1.6, String(idleSvg?.props.strokeWidth))
  check('glyph is decorative for a11y', idleSvg?.props['aria-hidden'] === true)

  const selected = renderEntry(rail, { data: baseState }, {}, { active: true })
  check('the selected entry thickens the stroke', findElement(selected.tree, (n) => n.tag === 'svg')?.props.strokeWidth === 1.9)
  const counting = renderEntry(rail, { data: { ...baseState, phase: 'counting', remainingSeconds: 30 } })
  const countingSvg = findElement(counting.tree, (n) => n.tag === 'svg')
  check('counting marks the phase', countingSvg?.props['data-phase'] === 'counting', countingSvg?.props['data-phase'])
  check('counting keeps the dot', classesOf(counting.tree).some((c) => c.includes('ipa-railDot')))
  const armed = renderEntry(rail, { data: { ...baseState, phase: 'armed' } })
  check('armed draws the pending dot', classesOf(armed.tree).some((c) => c.includes('ipa-railDot')), classesOf(armed.tree).join(','))
  const failed = renderEntry(rail, { data: { ...baseState, phase: 'failed' } })
  check('a failed action drops the dot', !classesOf(failed.tree).some((c) => c.includes('ipa-railDot')))
  check('a host-provided size is honoured', findElement(renderEntry(rail, { data: baseState }, {}, { size: 16 }).tree, (n) => n.tag === 'svg')?.props.width === 16)

  // The host may render the entry as a bare icon; the module store still feeds it.
  beginComponent()
  const bare = renderNode(rail.component({ size: 16 }))
  check('renders without injected props', bare !== null && findElement(bare, (n) => n.tag === 'svg') !== undefined)
}

console.log('\n=== page: idle ===')
{
  const { tree } = renderEntry(page, pageState(baseState))
  const texts = textsOf(tree)
  const joined = texts.join('|')
  check('renders the page shell', countClass(tree, 'ipa-page') === 1)
  check('has exactly one h1', countClass(tree, 'ipa-pageTitle') === 1 && findElement(tree, (n) => n.tag === 'h1')?.children[0].text === 'page.title')
  check('shows the eyebrow', texts.includes('page.eyebrow'), joined)
  check('shows the subtitle', texts.includes('page.subtitle'), joined)
  check('status reads idle', texts.includes('status.idle'), joined)
  check('explains the idle state', texts.includes('body.idle'), joined)
  check('offers the action that names the chosen mode', texts.includes('page.armHibernate') || texts.includes('page.armShutdown'), joined)
  check('does not offer cancel when idle', !texts.includes('page.cancel'), joined)
  const primary = findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-button') && n.props['data-variant'] === 'primary')
  check('预约 is the primary action', primary !== undefined)
  check('预约 is enabled when ready', primary?.props.disabled === false, String(primary?.props.disabled))
  check('offers a refresh control', byClass(tree, 'ipa-iconButton') !== undefined)

  // The counters explain a *blocked* run, so an idle page does not show three
  // zeroes that carry no information: the hero already says nothing is running.
  check('hides the counters while idle', countClass(tree, 'ipa-metric') === 0, String(countClass(tree, 'ipa-metric')))
  check('no redundant total metric', !texts.includes('metric.total') && !joined.includes('metric.total'))

  const radios = modeRadiosOf(tree)
  check('renders two native mode radios', radios.length === 2, String(radios.length))
  check('hibernate is checked by default', radios[0]?.props.checked === true)
  check('shutdown is not checked by default', radios[1]?.props.checked === false)
  check('mode radios share one group name', radios[0]?.props.name === 'ipa-mode' && radios[1]?.props.name === 'ipa-mode')
  check('mode radios live in a radiogroup', findElement(tree, (n) => n.props.role === 'radiogroup') !== undefined)
  // The visible card is the label, so the whole card is the hit area and the
  // description reaches the control as a description, not as part of its name.
  const modeLabels = []
  walkElements(tree, (node) => { if (node.props.className === 'ipa-modeCard') modeLabels.push(node) })
  check('each mode card is a label wrapping its control', modeLabels.length === 2 && modeLabels.every((label) => inputOf(label) !== undefined))
  check('mode controls name themselves by their title', radios[0]?.props['aria-label'] === 'mode.hibernate', String(radios[0]?.props['aria-label']))
  check('mode controls point at their description', typeof radios[0]?.props['aria-describedby'] === 'string' && radios[0].props['aria-describedby'].length > 0)
  check('the description element exists', findElement(tree, (n) => n.props.id === radios[0]?.props['aria-describedby']) !== undefined)
  check('describes both modes', texts.includes('mode.hibernateDesc') && texts.includes('mode.shutdownDesc'), joined)
  check('shows the hibernate note for the selected mode', texts.includes('note.hibernate'), joined)

  const options = bgOptions(tree)
  check('renders exactly three background presets', options.length === 3, String(options.length))
  check('solid is checked by default', inputOf(options[0])?.props.checked === true)
  check('the other presets are unchecked', inputOf(options[1])?.props.checked === false && inputOf(options[2])?.props.checked === false)
  check('presets are a native radio group', findElement(tree, (n) => n.props.role === 'radiogroup' && n.props['aria-label'] === 'section.background') !== undefined)
  check('describes the active preset', texts.includes('background.solidDesc'), joined)
  check('does not describe an inactive preset', !texts.includes('background.blurDesc'), joined)

  check('renders the three flow steps', countClass(tree, 'ipa-flowStep') === 3, String(countClass(tree, 'ipa-flowStep')))
  check('states the quiet window', texts.some((s) => s.includes('flow.idle')), joined)
  check('states the countdown window', texts.some((s) => s.includes('flow.countdown')), joined)
  check('names the action that will run', texts.includes('mode.hibernate'), joined)
  check('lists the notes', countClass(tree, 'ipa-noteItem') === 4, String(countClass(tree, 'ipa-noteItem')))
  check('states what is not monitored', texts.includes('note.scope'), joined)
  check('states that a Host restart cancels', texts.includes('note.hostRestart'), joined)
  check('footer repeats the phase', byClass(tree, 'ipa-footInner') !== undefined)
  check('no dialog is used for a page', rolesOf(tree, 'dialog').length === 0)
}

console.log('\n=== page: armed with running work ===')
{
  const armed = renderEntry(page, pageState({ ...baseState, phase: 'armed', busy: { available: true, agentsRunning: 3, inboxPending: 1, jobsRunning: 2, total: 6 } }))
  const texts = textsOf(armed.tree)
  const joined = texts.join('|')
  check('reports the running task count', joined.includes('6'), joined)
  check('explains why it waits', texts.includes('body.waiting'), joined)
  check('offers cancel', texts.includes('page.cancel'), joined)
  check('does not still offer 预约', !texts.includes('page.armHibernate') && !texts.includes('page.armShutdown'), joined)
  const danger = findElement(armed.tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-button') && n.props['data-variant'] === 'danger')
  check('cancel is the header action', danger !== undefined)
  check('cancel is enabled', danger?.props.disabled === false, String(danger?.props.disabled))
  check('breakdown reaches the metrics', ['3', '1', '2'].every((n) => texts.includes(n)), joined)
  check('no hero digits while tasks run', byClass(armed.tree, 'ipa-heroNum') === undefined)
}

console.log('\n=== page: armed and quiet ===')
{
  const quiet = renderEntry(page, pageState({ ...baseState, phase: 'armed', quietRemainingSeconds: 12, busy: { ...baseState.busy, total: 0 } }))
  const texts = textsOf(quiet.tree)
  check('explains the idle confirmation', texts.includes('body.quiet'), texts.join('|'))
  check('counts the remaining idle seconds', byClass(quiet.tree, 'ipa-heroNum')?.children[0].text === '12', textsOf(byClass(quiet.tree, 'ipa-heroNum')).join(''))
  check('shows a progress ring for the idle window', byClass(quiet.tree, 'ipa-heroRingValue') !== undefined)
}

console.log('\n=== page: counting down ===')
{
  const counting = renderEntry(page, pageState({ ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null }))
  const texts = textsOf(counting.tree)
  const joined = texts.join('|')
  check('names the countdown', joined.includes('status.counting'), joined)
  check('shows the remaining seconds', byClass(counting.tree, 'ipa-heroNum')?.children[0].text === '45')
  check('explains auto-void', texts.includes('body.counting'), joined)
  check('offers cancel while counting', texts.includes('page.cancel'), joined)
  const value = byClass(counting.tree, 'ipa-heroRingValue')
  const circumference = 2 * Math.PI * 42
  check('ring circumference matches the radius', Math.abs(Number(value?.props['stroke-dasharray']) - circumference) < 0.01, String(value?.props['stroke-dasharray']))
  check('ring sweep reflects the time left', Math.abs(Number(value?.props['stroke-dashoffset']) - circumference * 0.25) < 0.01, String(value?.props['stroke-dashoffset']))

  const clockT = (key) => (key === 'status.scheduledAt' ? '预计 %s 执行' : key)
  const clockTexts = textsOf(renderEntry(page, pageState({ ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null }), { t: clockT }).tree)
  check('shows the wall-clock execution time', clockTexts.some((s) => /\d{2}:\d{2}:\d{2}/.test(s)), clockTexts.join('|'))

  const urgent = renderEntry(page, pageState({ ...baseState, phase: 'counting', remainingSeconds: 4, countdownSeconds: 60, deadline: null }))
  check('marks the last seconds as urgent', byClass(urgent.tree, 'ipa-heroDial')?.props['data-urgent'] === true)
}

console.log('\n=== page: announcements and progress semantics ===')
{
  const idle = renderEntry(page, pageState(baseState))
  const status = findElement(idle.tree, (n) => n.props.role === 'status')
  check('exposes one polite status region', status !== undefined)
  check('the status region is visually hidden', typeof status?.props.className === 'string' && status.props.className.includes('ipa-srOnly'), String(status?.props.className))
  check('idle announces the idle phase', textsOf(status).join('') === 'status.idle', textsOf(status).join(''))
  check('the visible phase text is not itself a live region', findElement(idle.tree, (n) => n.props.className === 'ipa-heroPhase')?.props.role === undefined)

  const counting = renderEntry(page, pageState({ ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null }))
  const countingStatus = findElement(counting.tree, (n) => n.props.role === 'status')
  check('counting announces the phase without the seconds', textsOf(countingStatus).join('') === 'status.counting', textsOf(countingStatus).join(''))
  const bar = findElement(counting.tree, (n) => n.props.role === 'progressbar')
  check('the ring is a progressbar', bar !== undefined)
  check('progressbar reports the remaining value', bar?.props['aria-valuenow'] === 45, String(bar?.props['aria-valuenow']))
  check('progressbar reports the window as its max', bar?.props['aria-valuemax'] === 60, String(bar?.props['aria-valuemax']))
  check('progressbar has a label', bar?.props['aria-label'] === 'hero.progress', String(bar?.props['aria-label']))
  check('progressbar has a value text', typeof bar?.props['aria-valuetext'] === 'string' && bar.props['aria-valuetext'].length > 0)
  check('no progressbar while idle', findElement(idle.tree, (n) => n.props.role === 'progressbar') === undefined)

  check('no counter list while idle', findElement(idle.tree, (n) => n.tag === 'dl' && typeof n.props.className === 'string' && n.props.className.includes('ipa-metrics')) === undefined)
}

console.log('\n=== page: the counters explain a blocked run ===')
{
  // baseState is the shared snapshot; only the load changes here.
  const busyPage = renderEntry(page, pageState({
    ...baseState,
    busy: { available: true, agentsRunning: 2, inboxPending: 3, jobsRunning: 1, total: 6 },
  }))
  const busyTexts = textsOf(busyPage.tree)
  const busyJoined = busyTexts.join('|')
  check('renders three counters', countClass(busyPage.tree, 'ipa-metric') === 3, String(countClass(busyPage.tree, 'ipa-metric')))
  check('names running agents', busyTexts.includes('metric.agents'), busyJoined)
  check('names queued messages', busyTexts.includes('metric.inbox'), busyJoined)
  check('names background jobs', busyTexts.includes('metric.jobs'), busyJoined)
  check('shows the live counts', ['2', '3', '1'].every((n) => busyTexts.includes(n)), busyJoined)
  check('the group has a label', findElement(busyPage.tree, (n) => n.tag === 'dl' && n.props['aria-label'] === 'metric.group') !== undefined)
  check('each counter pairs a term with a value', countClass(busyPage.tree, 'ipa-metricLabel') === 3 && countClass(busyPage.tree, 'ipa-metricValue') === 3)
}

console.log('\n=== page: mode and appearance reach the Host ===')
{
  const calls = { setMode: [], arm: [] }
  const idle = renderEntry(page, pageState(baseState), {
    setMode: async (value) => { calls.setMode.push(value); return true },
    arm: async (value) => { calls.arm.push(value); return true },
  })
  const radios = modeRadiosOf(idle.tree)
  radios[1].props.onChange()
  check('selecting shutdown stores it on the Host', calls.setMode.length === 1 && calls.setMode[0] === 'shutdown', JSON.stringify(calls.setMode))
  check('selecting a mode while idle does not arm', calls.arm.length === 0, JSON.stringify(calls.arm))
  radios[0].props.onChange()
  check('choosing the already-selected mode is a no-op', calls.setMode.length === 1, JSON.stringify(calls.setMode))

  const armedCalls = { setMode: [], arm: [] }
  const armed = renderEntry(page, pageState({ ...baseState, phase: 'armed' }), {
    setMode: async (value) => { armedCalls.setMode.push(value); return true },
    arm: async (value) => { armedCalls.arm.push(value); return true },
  })
  modeRadiosOf(armed.tree)[1].props.onChange()
  check('changing mode while armed re-arms', armedCalls.arm.length === 1 && armedCalls.arm[0] === 'shutdown', JSON.stringify(armedCalls.arm))
  check('the armed path does not use the idle write', armedCalls.setMode.length === 0, JSON.stringify(armedCalls.setMode))

  const bgCalls = []
  const appearance = renderEntry(page, pageState(baseState), { setBackground: async (value) => { bgCalls.push(value); return true } })
  const presets = bgOptions(appearance.tree)
  inputOf(presets[1]).props.onChange()
  inputOf(presets[2]).props.onChange()
  check('choosing a preset reaches the Host', bgCalls.length === 2 && bgCalls[0] === 'glass' && bgCalls[1] === 'blur', JSON.stringify(bgCalls))
  check('presets are a native radio group', byClass(appearance.tree, 'ipa-bgOptions')?.props.role === 'radiogroup')

  const opened = []
  const previewable = renderEntry(page, pageState(baseState), { openPreview: () => { opened.push(1) } })
  const previewButton = findElement(previewable.tree, (n) => n.tag === 'button' && textsOf(n).join('').includes('preview.button'))
  check('the appearance section offers a preview button', previewButton !== undefined)
  previewButton?.props.onClick?.()
  check('the preview button opens the rehearsal', opened.length === 1, String(opened.length))

  const refreshed = []
  const refreshable = renderEntry(page, pageState(baseState), { refresh: async () => { refreshed.push(1); return true } })
  byClass(refreshable.tree, 'ipa-iconButton').props.onClick()
  check('the refresh control asks the Host again', refreshed.length === 1)
}

console.log('\n=== page: states that must not look idle ===')
{
  const loading = renderEntry(page, { data: baseState, ready: false, offline: false, busy: false, note: null })
  check('says it is loading before the first state', textsOf(loading.tree).includes('page.loading'), textsOf(loading.tree).join('|'))
  check('cannot arm before the first state', findElement(loading.tree, (n) => n.props['data-variant'] === 'primary')?.props.disabled === true)

  const offline = renderEntry(page, pageState(baseState, { offline: true }))
  check('surfaces the offline status', textsOf(offline.tree).includes('status.offline'), textsOf(offline.tree).join('|'))
  check('cannot arm while offline', findElement(offline.tree, (n) => n.props['data-variant'] === 'primary')?.props.disabled === true)
  check('marks the hero as an error', byClass(offline.tree, 'ipa-hero')?.props['data-tone'] === 'error')

  const unsupported = renderEntry(page, pageState({ ...baseState, supported: false, platform: 'linux' }))
  check('explains the platform limit', textsOf(unsupported.tree).includes('status.unsupported'), textsOf(unsupported.tree).join('|'))
  check('cannot arm on another platform', findElement(unsupported.tree, (n) => n.props['data-variant'] === 'primary')?.props.disabled === true)

  const registry = renderEntry(page, pageState({ ...baseState, busy: { available: false, agentsRunning: 0, inboxPending: 0, jobsRunning: 0, total: 0 } }))
  check('explains the paused countdown', textsOf(registry.tree).includes('status.registryUnavailable'), textsOf(registry.tree).join('|'))
  check('refuses to arm without a registry', findElement(registry.tree, (n) => n.props['data-variant'] === 'primary')?.props.disabled === true)

  const executing = renderEntry(page, pageState({ ...baseState, phase: 'executing' }))
  check('reports the running power action', textsOf(executing.tree).includes('status.executing'), textsOf(executing.tree).join('|'))
  check('cannot stack another action', findElement(executing.tree, (n) => n.props['data-variant'] === 'primary')?.props.disabled === true)
  check('locks the mode cards while executing', radiosOf(executing.tree).every((node) => node.props.disabled === true))
  check('locks the appearance presets while executing', presetDisabled(executing.tree).every((disabled) => disabled === true))

  const failed = renderEntry(page, pageState({ ...baseState, phase: 'failed', error: 'shutdown exited 1' }))
  check('shows the failure', textsOf(failed.tree).includes('status.failed'), textsOf(failed.tree).join('|'))
  check('includes the error detail', textsOf(failed.tree).some((s) => s.includes('shutdown exited 1')), textsOf(failed.tree).join('|'))
  check('marks the hero as an error after a failure', byClass(failed.tree, 'ipa-hero')?.props['data-tone'] === 'error')
}

console.log('\n=== page: refusals are shown in the reader\'s language ===')
{
  const refused = renderEntry(page, pageState(baseState, { note: 'command not found' }))
  check('surfaces the refusal note', textsOf(refused.tree).some((s) => s.includes('command not found')), textsOf(refused.tree).join('|'))
  check('announces the refusal', rolesOf(refused.tree, 'alert').length === 1)

  const coded = renderEntry(page, pageState(baseState, { note: 'the power command is already executing', noteCode: 'execution-in-progress' }), {
    t: (key) => (key === 'error.execution-in-progress' ? '电源操作已经开始执行，无法再取消。' : key),
  })
  const codedTexts = textsOf(coded.tree)
  check('localizes a known Host error code', codedTexts.some((s) => s.includes('无法再取消')), codedTexts.join('|'))
  check('does not leak the raw message for a known code', !codedTexts.some((s) => s.includes('already executing')), codedTexts.join('|'))

  const busy = renderEntry(page, pageState(baseState, { busy: true }))
  check('cannot stack submissions', findElement(busy.tree, (n) => n.props['data-variant'] === 'primary')?.props.disabled === true)
  check('labels the pending submission', textsOf(busy.tree).includes('page.saving'), textsOf(busy.tree).join('|'))
}


console.log('\n=== page: solid colour ===')
{
  const colorOptions = (tree) => {
    const found = []
    walkElements(tree, (node) => {
      if (typeof node.props.className === 'string' && node.props.className.split(' ').includes('ipa-colorOption')) found.push(node)
    })
    return found
  }

  const solid = renderEntry(page, pageState(baseState))
  const options = colorOptions(solid.tree)
  check('offers the theme option, six presets and a custom picker', options.length === 8, String(options.length))
  check('the theme option is chosen by default', inputOf(options[0])?.props.checked === true)
  check('presets are unchecked by default', options.slice(1, 7).every((option) => inputOf(option)?.props.checked === false))
  check('the row is a radio group', findElement(solid.tree, (n) => n.props.role === 'radiogroup' && n.props['aria-label'] === 'color.label') !== undefined)
  check('a custom colour input exists', findElement(solid.tree, (n) => n.tag === 'input' && n.props.type === 'color') !== undefined)
  check('explains the automatic ink', textsOf(solid.tree).includes('color.hint'), textsOf(solid.tree).join('|'))

  const glass = renderEntry(page, pageState({ ...baseState, backgroundStyle: 'glass' }))
  check('the colour row is hidden for the other presets', colorOptions(glass.tree).length === 0, String(colorOptions(glass.tree).length))

  const calls = []
  const interactive = renderEntry(page, pageState(baseState), { setColor: async (value) => { calls.push(value); return true } })
  const live = colorOptions(interactive.tree)
  inputOf(live[2]).props.onChange()
  check('choosing a preset reaches the Host', calls.length === 1 && /^#[0-9a-f]{6}$/.test(calls[0]), JSON.stringify(calls))
  const custom = findElement(interactive.tree, (n) => n.tag === 'input' && n.props.type === 'color')
  custom.props.onChange({ currentTarget: { value: '#123456' } })
  check('the custom picker reaches the Host', calls.length === 2 && calls[1] === '#123456', JSON.stringify(calls))
  custom.props.onChange({ currentTarget: { value: 'not-a-colour' } })
  check('an invalid pick is ignored', calls.length === 2, JSON.stringify(calls))

  const preset = renderEntry(page, pageState({ ...baseState, countdownColor: '#1c2a44' }), { setColor: async () => true })
  check('the stored colour is the checked preset', colorOptions(preset.tree).filter((option) => inputOf(option)?.props.checked === true).map((option) => inputOf(option).props.value).join() === '#1c2a44')
}

console.log('\n=== countdown: pinned colour and ink ===')
{
  const paint = (data) => findElement(renderEntry(countdown, { data, offline: false, busy: false, note: null }).tree, (n) => n.props['aria-modal'] === true)
  const counting = { ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null }

  const dark = paint({ ...counting, backgroundStyle: 'solid', countdownColor: '#16233a' })
  check('a dark pick gets light ink', dark?.props['data-ink'] === 'light', String(dark?.props['data-ink']))
  check('the colour is pinned as the card surface token', dark?.props.style?.['--dsw-alias-bg-overlay'] === '#16233a', JSON.stringify(dark?.props.style))

  const light = paint({ ...counting, backgroundStyle: 'solid', countdownColor: '#f2e9d8' })
  check('a light pick gets dark ink', light?.props['data-ink'] === 'dark', String(light?.props['data-ink']))

  const themed = paint({ ...counting, backgroundStyle: 'solid', countdownColor: null })
  check('following the theme pins no ink', themed?.props['data-ink'] === undefined, String(themed?.props['data-ink']))
  check('following the theme pins no colour', themed?.props.style === undefined, JSON.stringify(themed?.props.style))

  const glass = paint({ ...counting, backgroundStyle: 'glass', countdownColor: '#16233a' })
  check('a pinned colour cannot leak onto the other presets', glass?.props['data-ink'] === undefined && glass?.props.style === undefined)
}

console.log('\n=== page: whole-screen switch ===')
{
  const off = renderEntry(page, pageState(baseState))
  const toggle = findElement(off.tree, (n) => n.tag === 'input' && n.props.type === 'checkbox')
  check('the page offers a whole-screen switch', toggle !== undefined)
  check('it is off by default', toggle?.props.checked === false, String(toggle?.props.checked))
  check('the switch explains itself', textsOf(off.tree).join('|').includes('fullscreen.onWaitDesc'))

  const calls = []
  const on = renderEntry(page, pageState({ ...baseState, fullscreenOnWait: true }), {
    setFullscreenOnWait: async (value) => { calls.push(value); return true },
  })
  const input = findElement(on.tree, (n) => n.tag === 'input' && n.props.type === 'checkbox')
  check('it reflects the Host value', input?.props.checked === true)
  input?.props.onChange()
  check('turning it off reaches the Host', calls.length === 1 && calls[0] === false, JSON.stringify(calls))
}

console.log('\n=== page: stay-awake switch ===')
{
  // The page has two switches now; pick the one inside the stay-awake section so
  // the assertions cannot silently drift onto the whole-screen switch.
  const switchIn = (tree, titleKey) => {
    const sections = []
    walkElements(tree, (node) => {
      if (node.tag === 'section' && textsOf(node).join('').includes(titleKey)) sections.push(node)
    })
    const section = sections[0]
    if (section === undefined) return undefined
    return findElement(section, (node) => node.tag === 'input' && node.props.type === 'checkbox')
  }

  const defaults = renderEntry(page, pageState(baseState))
  check('stay-awake is on by default', switchIn(defaults.tree, 'section.awake')?.props.checked === true)
  check('the whole-screen switch stays off by default', switchIn(defaults.tree, 'section.fullscreen')?.props.checked === false)

  const calls = []
  const armed = { stayAwake: true }
  const on = renderEntry(page, pageState({ ...baseState, ...armed }), {
    setStayAwake: async (value) => { calls.push(value); return true },
  })
  switchIn(on.tree, 'section.awake')?.props.onChange?.()
  check('turning it off reaches the Host', calls.length === 1 && calls[0] === false, JSON.stringify(calls))

  const alreadyOff = renderEntry(page, pageState({ ...baseState, stayAwake: false }), {
    setStayAwake: async (value) => { calls.push(value); return true },
  })
  check('the switch reflects a disabled setting', switchIn(alreadyOff.tree, 'section.awake')?.props.checked === false)
  check('explains what a suspended Host costs', textsOf(defaults.tree).join('|').includes('awake.onDesc'))
}

console.log('\n=== wait screen: the whole screen while waiting ===')
{
  const waitEntry = byId('dsh-idle-power.wait')
  check('wait overlay is registered', waitEntry?.name === 'shell.overlay', waitEntry?.name)

  const load = { available: true, agentsRunning: 2, inboxPending: 3, jobsRunning: 1, total: 6 };
  const armed = {
    ...baseState,
    phase: 'armed',
    quietSeconds: 20,
    quietRemainingSeconds: 12,
    fullscreenOnWait: true,
    busy: load,
  };
  // The overlay reads the live counts off the snapshot, like the countdown does.
  const waitingStore = { data: armed, busy: load };

  check('nothing renders while the Host has it off', renderEntry(waitEntry, { data: { ...armed, fullscreenOnWait: false }, busy: load }).root === null)
  check('nothing renders outside the waiting phase', renderEntry(waitEntry, { data: { ...armed, phase: 'counting' }, busy: load }).root === null)

  const waiting = renderEntry(waitEntry, waitingStore)
  const texts = textsOf(waiting.tree)
  const joined = texts.join('|')
  check('says what it is waiting for', joined.includes('wait.title') && joined.includes('wait.subtitle'), joined)
  const progress = findElement(waiting.tree, (n) => n.props.role === 'progressbar')
  check('shows the quiet window as a progress bar', progress !== undefined && progress.props['aria-valuemax'] === 20, JSON.stringify(progress?.props))
  check('the bar tracks the elapsed quiet time', progress?.props['aria-valuenow'] === 8, String(progress?.props['aria-valuenow']))
  check('lists what is still running', joined.includes('wait.agents') && joined.includes('wait.inbox') && joined.includes('wait.jobs'), joined)
  check('shows the live counts', ['2', '3', '1'].every((count) => texts.includes(count)), joined)
  check('offers the way out', joined.includes('wait.cancel'))
  const waitTimer = findElement(waiting.tree, (n) => n.props.role === 'timer')
  check('the dial reports a number', waitTimer !== undefined && countClass(waiting.tree, 'ipa-count') === 1)
  check('that number is the blocking task count', texts.includes('wait.unitTasks') && texts.includes(String(load.total)), joined)
  check('the headline names what is blocking', joined.includes('wait.headlineBusy') && !joined.includes('wait.headlineQuiet'))
  check('it still shows no deadline', !joined.includes('countdown.remaining'))
  check('keeps the countdown notes', joined.includes('note.scope'))

  let cancelled = 0
  const interactive = renderEntry(waitEntry, waitingStore, { cancel: async () => { cancelled += 1; return true } })
  const cta = findElement(interactive.tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-cta'))
  check('the waiting screen has a cancel button', cta !== undefined)
  cta?.props.onClick?.()
  check('cancel reaches the Host from the waiting screen', cancelled === 1, String(cancelled))
}

console.log('\n=== wait screen: Escape closes the presentation, not the reservation ===')
{
  const waitEntry = byId('dsh-idle-power.wait')
  const load = { available: true, agentsRunning: 1, inboxPending: 0, jobsRunning: 0, total: 1 }
  const armed = {
    ...baseState,
    phase: 'armed',
    quietSeconds: 20,
    quietRemainingSeconds: 14,
    fullscreenOnWait: true,
    busy: load,
  }

  check('a dismissed presentation renders nothing', renderEntry(waitEntry, { data: armed, busy: load, waitDismissed: true }).root === null)

  let dismissed = 0
  let cancelled = 0
  const { tree } = renderEntry(waitEntry, { data: armed, busy: load, waitDismissed: false }, {
    dismiss: () => { dismissed += 1 },
    cancel: async () => { cancelled += 1; return true },
  })
  check('the waiting screen is on screen before Escape', findElement(tree, (n) => n.props.className === 'ipa-scrim ipa-scrimWait') !== undefined)

  fire('keydown', { key: 'Escape', preventDefault() {} })
  check('Escape closes the whole presentation', dismissed === 1, String(dismissed))
  check('Escape does not cancel the reservation', cancelled === 0, String(cancelled))

  const cta = findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-cta'))
  check('the cancel button no longer claims Escape', !textsOf(cta ?? { children: [] }).includes('Esc'))
  check('the screen explains what Escape does', textsOf(tree).join('|').includes('wait.escHint'), textsOf(tree).join('|'))
}

console.log('\n=== countdown: the two-step Escape is explained ===')
{
  const counting = { data: { ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null } }
  let fullscreenElement = null
  documentStub.documentElement = { requestFullscreen: () => Promise.resolve() }
  Object.defineProperty(documentStub, 'fullscreenElement', { configurable: true, get: () => fullscreenElement })

  const windowed = renderEntry(countdown, counting)
  check('no Escape explanation while windowed', !textsOf(windowed.tree).join('|').includes('countdown.escFullscreen'))

  fullscreenElement = { tagName: 'HTML' }
  const full = renderEntry(countdown, counting)
  check('fullscreen explains the two-step Escape', textsOf(full.tree).join('|').includes('countdown.escFullscreen'), textsOf(full.tree).join('|'))

  delete documentStub.documentElement
  delete documentStub.fullscreenElement
}

console.log('\n=== countdown: whole-screen fullscreen ===')
{
  // The fake document has no fullscreen API, so this block lends it one and
  // takes it back: the same component has to work with and without the API.
  const counting = { data: { ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null } }
  const fullscreenButtons = (tree) => {
    const found = []
    walkElements(tree, (node) => {
      if (node.tag === 'button' && textsOf(node).join('').includes('countdown.fullscreen')) found.push(node)
    })
    return found
  }

  check('no fullscreen button without the API', fullscreenButtons(renderEntry(countdown, counting).tree).length === 0)

  const calls = []
  const listeners = new Set()
  let fullscreenElement = null
  documentStub.documentElement = {
    requestFullscreen: (options) => { calls.push(options ?? {}); return Promise.resolve() },
  }
  Object.defineProperty(documentStub, 'fullscreenElement', { configurable: true, get: () => fullscreenElement })
  documentStub.addEventListener = (type, fn) => { if (type === 'fullscreenchange') listeners.add(fn) }
  documentStub.removeEventListener = (type, fn) => { if (type === 'fullscreenchange') listeners.delete(fn) }
  documentStub.exitFullscreen = () => Promise.resolve()

  const attempt = renderEntry(countdown, counting)
  check('asks for the whole screen as soon as the countdown opens', calls.length === 1, String(calls.length))
  check('hides the window chrome while entering', calls[0]?.navigationUI === 'hide', JSON.stringify(calls[0]))
  check('listens for the engine reporting back', listeners.size === 1, String(listeners.size))
  const button = fullscreenButtons(attempt.tree)[0]
  check('offers a manual fullscreen button', button !== undefined)
  check('the button explains what it does', button?.props.title === 'countdown.fullscreenHint', String(button?.props.title))
  button?.props.onClick?.()
  check('the button retries the same request', calls.length === 2, String(calls.length))
  calls.length = 0
  const already = renderEntry(countdown, counting)
  check('a refused request leaves the button in place', fullscreenButtons(already.tree).length === 1)

  fullscreenElement = { tagName: 'HTML' }
  calls.length = 0
  const inFullscreen = renderEntry(countdown, counting)
  check('no request while the screen is already ours', calls.length === 0, String(calls.length))
  check('the button disappears in fullscreen', fullscreenButtons(inFullscreen.tree).length === 0)
  check('a fullscreen countdown says it covers the screen', textsOf(inFullscreen.tree).includes('countdown.scopeTagFull'), textsOf(inFullscreen.tree).join('|'))
  check('a windowed countdown is honest about its scope', textsOf(attempt.tree).includes('countdown.scopeTag'))

  delete documentStub.documentElement
  delete documentStub.fullscreenElement
  delete documentStub.addEventListener
  delete documentStub.removeEventListener
  delete documentStub.exitFullscreen
}

console.log('\n=== preview: a rehearsal, not a countdown ===')
{
  const previewEntry = byId('dsh-idle-power.preview')
  check('preview overlay is registered', previewEntry?.name === 'shell.overlay', previewEntry?.name)

  const closed = renderEntry(previewEntry, { data: baseState, preview: false })
  check('nothing renders while the preview is closed', closed.root === null)

  let closes = 0
  const open = renderEntry(previewEntry, { data: { ...baseState, mode: 'shutdown' }, preview: true }, { close: () => { closes += 1 } })
  const texts = textsOf(open.tree)
  const joined = texts.join('|')
  check('renders the countdown component', findElement(open.tree, (n) => n.props['aria-modal'] === true) !== undefined)
  check('labels itself as a preview', joined.includes('preview.title') && joined.includes('preview.subtitle'), joined)
  check('says nothing will run', joined.includes('preview.noAction') && joined.includes('preview.hint'), joined)
  check('the escape hatch is the preview close action', joined.includes('preview.close'), joined)
  check('a preview leaves the real countdown copy alone', !joined.includes('countdown.quietDone'), joined)
  const cancelButton = findElement(open.tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-cta'))
  cancelButton?.props.onClick?.()
  check('closing the preview does not touch the Host', closes === 1, String(closes))
  check('the preview does not rewrite the window title', !String(documentStub.title ?? '').includes('preview'))
}

console.log('\n=== countdown: hidden unless counting ===')
{
  check('null when idle', renderEntry(countdown, { data: baseState }).root === null)
  check('null when armed', renderEntry(countdown, { data: { ...baseState, phase: 'armed' } }).root === null)
  check('null when failed', renderEntry(countdown, { data: { ...baseState, phase: 'failed' } }).root === null)
}

console.log('\n=== countdown: visible ===')
{
  const counting = { data: { ...baseState, phase: 'counting', mode: 'hibernate', remainingSeconds: 45, countdownSeconds: 60, deadline: null } }
  const { tree } = renderEntry(countdown, counting)
  const classes = classesOf(tree)
  check('renders the scrim', classes.some((c) => c.includes('ipa-scrim')), classes.join(','))
  check('renders a card inside the scrim', classes.some((c) => c.includes('ipa-card')), classes.join(','))
  const dialog = findElement(tree, (n) => n.props['aria-modal'] === true)
  check('is an alert dialog', dialog?.props.role === 'alertdialog', String(dialog?.props.role))
  const texts = textsOf(tree)
  const numeric = texts.filter((s) => /^\d+$/.test(s))
  check('shows a numeric countdown', numeric.length > 0, texts.join('|'))
  check('countdown is a real number, not NaN', numeric.every((s) => Number.isFinite(Number(s))), numeric.join(','))
  check('countdown is within range', numeric.every((s) => Number(s) >= 0 && Number(s) <= 60), numeric.join(','))
  check('names the action', texts.includes('countdown.hibernate'), texts.join('|'))
  check('offers cancel', texts.includes('countdown.cancel'), texts.join('|'))
  check('shows the Esc affordance', texts.includes('Esc'), texts.join('|'))
  check('explains auto-void', texts.includes('countdown.hint'), texts.join('|'))

  // The dial must be a real progress indicator, not decoration.
  const value = findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-ringValue'))
  check('renders the progress ring', value !== undefined)
  const circumference = 2 * Math.PI * 54
  check('ring circumference matches the radius', Math.abs(Number(value?.props['stroke-dasharray']) - circumference) < 0.01, String(value?.props['stroke-dasharray']))
  // 45s of 60s left => the arc shows 75% remaining.
  const expected = circumference * (1 - 45 / 60)
  check('ring sweep reflects time remaining', Math.abs(Number(value?.props['stroke-dashoffset']) - expected) < 0.01, `${value?.props['stroke-dashoffset']} vs ${expected}`)
}

console.log('\n=== countdown: ring edge cases ===')
{
  const circumference = 2 * Math.PI * 54
  const dialValue = (data) => {
    const { tree } = renderEntry(countdown, { data })
    const el = findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-ringValue'))
    return Number(el?.props['stroke-dashoffset'])
  }
  const full = dialValue({ ...baseState, phase: 'counting', remainingSeconds: 60, countdownSeconds: 60, deadline: null })
  check('full time leaves an empty offset', Math.abs(full) < 0.01, String(full))
  const empty = dialValue({ ...baseState, phase: 'counting', remainingSeconds: 0, countdownSeconds: 60, deadline: null })
  check('zero time sweeps the whole ring', Math.abs(empty - circumference) < 0.01, String(empty))
  const over = dialValue({ ...baseState, phase: 'counting', remainingSeconds: 90, countdownSeconds: 60, deadline: null })
  check('never overshoots when remaining exceeds the window', over >= 0, String(over))
  const zeroTotal = dialValue({ ...baseState, phase: 'counting', remainingSeconds: 30, countdownSeconds: 0, deadline: null })
  check('a zero-length window does not produce NaN', Number.isFinite(zeroTotal), String(zeroTotal))

  // A live deadline must move the ring by fractions, not whole seconds, or the
  // sweep visibly steps once a second.
  const live = dialValue({ ...baseState, phase: 'counting', remainingSeconds: 60, countdownSeconds: 60, deadline: Date.now() + 59900 })
  check('a live deadline advances the ring fractionally', live > 0.01 && live < circumference, String(live))
}

console.log('\n=== countdown: stable digits ===')
{
  const counting = { data: { ...baseState, phase: 'counting', remainingSeconds: 47, countdownSeconds: 60, deadline: null } }
  const { tree } = renderEntry(countdown, counting)
  const digit = findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className === 'ipa-count')
  check('the digit renders the current second', textsOf(digit).join('') === '47')
  const later = renderEntry(countdown, { data: { ...baseState, phase: 'counting', remainingSeconds: 46, countdownSeconds: 60, deadline: null } }).tree
  const digit2 = findElement(later, (n) => typeof n.props.className === 'string' && n.props.className === 'ipa-count')
  check('the text updates when the second changes', textsOf(digit2).join('') === '46')
  check('second changes do not force the digit to remount', digit?.props.key === undefined && digit2?.props.key === undefined)
  check('the countdown card still renders', findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-card')) !== undefined)
  check('ring still present', findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-ringValue')) !== undefined)
}

console.log('\n=== motion: reduced-motion coverage in CSS ===')
{
  // The stylesheet is a plain string, so assert on its text directly.
  const fs = require('node:fs')
  const css = fs.readFileSync(process.argv[2] ?? require('node:path').join(__dirname, '..', 'client.js'), 'utf8')
  check('respects prefers-reduced-motion', css.includes('prefers-reduced-motion:reduce'))
  const reduceBlock = css.slice(css.lastIndexOf('prefers-reduced-motion:reduce'))
  for (const sel of ['ipa-page', 'ipa-scrim', 'ipa-card']) {
    check(`reduced motion disables ${sel}`, reduceBlock.includes(sel), sel)
  }
  check('animations declare keyframes', css.includes('@keyframes ipa-fade') && css.includes('@keyframes ipa-dial-in') && css.includes('@keyframes ipa-blink'))
}


console.log('\n=== countdown: urgent near zero ===')
{
  const urgent = { data: { ...baseState, phase: 'counting', mode: 'shutdown', remainingSeconds: 4, countdownSeconds: 60, deadline: Date.now() + 4000 } }
  const { tree } = renderEntry(countdown, urgent)
  const urgentNode = findElement(tree, (n) => typeof n.props['data-urgent'] !== 'undefined')
  check('urgent flag set under 10s', urgentNode !== undefined)
  check('names shutdown', textsOf(tree).includes('countdown.shutdown'), textsOf(tree).join('|'))
  const calm = renderEntry(countdown, { data: { ...baseState, phase: 'counting', remainingSeconds: 40, countdownSeconds: 60, deadline: null } })
  check('no urgent flag when there is time', findElement(calm.tree, (n) => typeof n.props['data-urgent'] !== 'undefined') === undefined)
}

console.log('\n=== countdown: expired deadline clamps at zero ===')
{
  const expired = { data: { ...baseState, phase: 'counting', deadline: Date.now() - 5000, countdownSeconds: 60 } }
  const { tree } = renderEntry(countdown, expired)
  const numeric = textsOf(tree).filter((s) => /^\d+$/.test(s))
  check('never renders a negative number', numeric.every((s) => Number(s) >= 0), numeric.join(','))
  check('renders zero', numeric.includes('0'), numeric.join(','))
  const value = findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-ringValue'))
  check('ring is fully swept at zero', Math.abs(Number(value?.props['stroke-dashoffset']) - 2 * Math.PI * 54) < 0.01)
}

console.log('\n=== countdown: no deadline falls back to the server value ===')
{
  const fallback = { data: { ...baseState, phase: 'counting', remainingSeconds: 42, countdownSeconds: 60, deadline: null } }
  const { tree } = renderEntry(countdown, fallback)
  check('uses the server remainingSeconds', textsOf(tree).includes('42'), textsOf(tree).join('|'))
}

console.log('\n=== countdown: full-window layout and richer information ===')
{
  const counting = {
    data: { ...baseState, phase: 'counting', mode: 'hibernate', remainingSeconds: 45, countdownSeconds: 60, quietSeconds: 20, deadline: null },
    offline: false, busy: false, note: null,
  }
  const { tree } = renderEntry(countdown, counting)
  const texts = textsOf(tree)
  const joined = texts.join('|')
  check('states how long the quiet period ran', joined.includes('countdown.quietDone'), joined)
  check('states the cancellation window', joined.includes('countdown.window'), joined)
  check('states the scheduled time', joined.includes('countdown.scheduledAt'), joined)
  check('restates the monitoring scope', joined.includes('note.scope'), joined)
  check('labels which window is covered', joined.includes('countdown.scopeTag'), joined)

  const rail = findElement(tree, (n) => n.props.role === 'progressbar')
  check('renders an edge progressbar', rail !== undefined)
  check('progressbar exposes remaining seconds', rail?.props['aria-valuenow'] === 45, String(rail?.props['aria-valuenow']))
  check('progressbar exposes the window length', rail?.props['aria-valuemax'] === 60, String(rail?.props['aria-valuemax']))
  check('progressbar has an accessible label', rail?.props['aria-label'] === 'countdown.progress', String(rail?.props['aria-label']))
  const fill = findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes('ipa-railFill'))
  check('edge rail drains with the ring fraction', fill?.props.style?.transform === 'scaleX(0.75)', JSON.stringify(fill?.props.style))

  const hasClass = (name) => findElement(tree, (n) => typeof n.props.className === 'string' && n.props.className.includes(name)) !== undefined
  check('renders top / stage / bottom bands', hasClass('ipa-top') && hasClass('ipa-stage') && hasClass('ipa-bottom'))
  check('digits are a timer, not a chatty live region', findElement(tree, (n) => n.props.role === 'timer')?.props['aria-live'] === 'off')
  // The taskbar is the one cue that reaches a monitor the app window is not on.
  check('mirrors the countdown into the tab title', typeof documentStub.title === 'string' && documentStub.title.includes('45'), String(documentStub.title))
}

console.log('\n=== countdown: scheduled clock time is real copy ===')
{
  const counting = { data: { ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null } }
  const t = (key) => (key === 'countdown.scheduledAt' ? '预计 %s 执行' : key)
  const texts = textsOf(renderEntry(countdown, counting, { t }).tree)
  check('renders a HH:MM:SS wall-clock time', texts.some((s) => /\d{2}:\d{2}:\d{2}/.test(s)), texts.join('|'))
}

console.log('\n=== CSS: page shell and full-viewport countdown layout ===')
{
  const css = require('node:fs').readFileSync(process.argv[2] ?? require('node:path').join(__dirname, '..', 'client.js'), 'utf8')
  check('page is a container for its own column width', css.includes('container:ipa-page / inline-size'))
  check('page reflows against the column, not the viewport', css.includes('@container ipa-page (max-width:760px)'))
  check('page scrolls inside the main column', css.includes('.ipa-scroll{flex:1;min-height:0;overflow:auto'))
  check('page fills the main column height', css.includes('height:100%;min-height:0;overflow:hidden'))
  check('card fills the viewport with dvh', css.includes('min-height:100dvh'))
  check('hero scales with vmin', css.includes('52vmin'))
  check('edge rail is pinned to the viewport', css.includes('.ipa-rail{position:fixed'))
  check('short-viewport rules exist', css.includes('@media (max-height:620px)'))
  check('narrow-viewport rules exist', css.includes('@media (max-width:720px)'))
  check('left/right alignment rules exist', css.includes('[data-align=left]') && css.includes('[data-align=right]'))
  check('page type scale is rem, not px', !/font-size:\s*[0-9.]+px/.test(css.slice(css.indexOf('/* ---- page shell'), css.indexOf('/* ---- countdown'))))
  check('high contrast mode keeps borders and selection visible', css.includes('@media (forced-colors:active)') && css.includes('border-color:CanvasText') && css.includes('outline:2px solid Highlight'))
  check('the outline hover cannot repaint a filled button', css.includes('.ipa-button:not([data-variant]):hover:not(:disabled)'))
  check('filled and danger buttons own their hover state', css.includes('.ipa-button[data-variant=primary]:hover:not(:disabled)') && css.includes('.ipa-button[data-variant=danger]:hover:not(:disabled)'))
  check('the switch shows its state without moving the layout', css.includes('.ipa-toggle:has(> :checked) .ipa-toggleTrack') && css.includes('.ipa-toggle:has(> :checked) .ipa-toggleThumb'))
  check('the waiting dial is quieter than the countdown dial', css.includes('.ipa-dial[data-tone=calm]') && css.includes('.ipa-dial[data-tone=calm] .ipa-count'))
  check('the orb is gone', !css.includes('.ipa-waitOrb'))
  check('circles opt out of the Host squircle theme', css.includes('corner-shape:round') && /\.ipa-kbd,\.ipa-railDot\{corner-shape:round\}/.test(css), 'no corner-shape reset')
  check('the reset still covers the switch, swatches and dots', /\.ipa-colorSwatch/.test(css) && /\.ipa-toggleThumb/.test(css) && /\.ipa-statusDot/.test(css))
}


console.log('\n=== multi-screen: controls appear only with a second display ===')
{
  windowStub.screen = { isExtended: true }
  const counting = { data: { ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null } }
  const { tree } = renderEntry(countdown, counting)
  const texts = textsOf(tree)
  check('offers the mirror button', texts.includes('countdown.mirrors'), texts.join('|'))
  const group = findElement(tree, (n) => n.props.role === 'group' && n.props['aria-label'] === 'countdown.alignLabel')
  check('offers the alignment control', group !== undefined)
  const alignButtons = group.children.filter((c) => c && c.kind === 'element' && typeof c.props.className === 'string' && c.props.className.includes('ipa-alignBtn'))
  check('offers three alignment choices', alignButtons.length === 3, String(alignButtons.length))
  check('explains the single-window limitation', texts.includes('countdown.multiNote'), texts.join('|'))
  alignButtons[0].props.onClick()
  check('choosing an alignment does not throw', true)

  windowStub.screen = { isExtended: false }
  const single = renderEntry(countdown, counting).tree
  check('no mirror button on a single screen', !textsOf(single).includes('countdown.mirrors'), textsOf(single).join('|'))
  check('no alignment control on a single screen', findElement(single, (n) => n.props.role === 'group') === undefined)
  delete windowStub.screen
}

console.log('\n=== multi-screen: keyboard access ===')
{
  listeners.keydown.length = 0
  windowStub.screen = { isExtended: true }
  const counting = { data: { ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null } }
  const { tree } = renderEntry(countdown, counting)
  const group = findElement(tree, (n) => n.props.role === 'group' && n.props['aria-label'] === 'countdown.alignLabel')
  const alignButtons = group.children.filter((child) => child.kind === 'element' && child.tag === 'button')
  const mirror = findElement(tree, (n) => n.props.className === 'ipa-mirrors')
  const cancelButton = findElement(tree, (n) => n.props.className === 'ipa-cta')
  const buttons = [...alignButtons, mirror, cancelButton]
  tree.querySelectorAll = () => buttons.filter((button) => !button.props.disabled)
  for (const button of buttons) button.focus = () => { documentStub.activeElement = button }
  const pressTab = (shiftKey = false) => fire('keydown', { key: 'Tab', shiftKey, preventDefault() {} })

  cancelButton.focus()
  pressTab(true)
  check('Shift+Tab reaches the mirror button', documentStub.activeElement === mirror)
  pressTab(true)
  check('Shift+Tab reaches the right alignment button', documentStub.activeElement === alignButtons[2])
  pressTab(true)
  check('Shift+Tab reaches the center alignment button', documentStub.activeElement === alignButtons[1])
  alignButtons[0].focus()
  pressTab(true)
  check('Shift+Tab wraps to cancel', documentStub.activeElement === cancelButton)
  pressTab()
  check('Tab wraps to the left alignment button', documentStub.activeElement === alignButtons[0])
  mirror.props.disabled = true
  alignButtons[2].focus()
  pressTab()
  check('Tab skips a disabled mirror button', documentStub.activeElement === cancelButton)
  delete windowStub.screen
  delete documentStub.activeElement
  listeners.keydown.length = 0
}

console.log('\n=== multi-screen: pure placement helpers ===')
{
  const api = moduleObj.internals
  check('formats a %s template', api.fmt('预计 %s 执行', '02:31:07') === '预计 02:31:07 执行')
  check('a missing placeholder is harmless', api.fmt('countdown.window', '60') === 'countdown.window')
  check('formats a wall-clock time', /^\d{2}:\d{2}:\d{2}$/.test(api.formatClock(Date.now())))
  check('no screens detected when the API is absent', api.hasMultipleScreens() === false)

  const primary = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 }
  const secondary = { availLeft: -1920, availTop: -120, availWidth: 2560, availHeight: 1440 }
  const geo = api.mirrorGeometry({ currentScreen: primary, screens: [primary, secondary] })
  check('mirrors every screen except the current one', geo.length === 1, JSON.stringify(geo))
  check('keeps negative coordinates for a left/upper monitor', geo[0].left === -1920 && geo[0].top === -120, JSON.stringify(geo[0]))
  check('uses the other screen size', geo[0].width === 2560 && geo[0].height === 1440, JSON.stringify(geo[0]))
  check('placement features carry the geometry', api.mirrorFeatures(geo[0]).includes('left=-1920,top=-120,width=2560,height=1440'))
  const fallback = api.mirrorGeometry({ currentScreen: primary, screens: [primary] })
  check('a single screen falls back to one draggable window', fallback.length === 1 && fallback[0] === null)
  check('plain features still open a usable window', api.mirrorFeatures(null).includes('width=880'))
  check('missing dimensions never produce NaN', Number.isFinite(api.mirrorGeometry({ screens: [{ left: -800 }] })[0].width))
}

console.log('\n=== background presets: page control ===')
{
  const appearance = renderEntry(page, pageState(baseState))
  const texts = textsOf(appearance.tree)
  const joined = texts.join('|')
  check('names the appearance section', joined.includes('section.background'), joined)
  check('offers solid', texts.includes('background.solid'), joined)
  check('offers frosted glass', texts.includes('background.glass'), joined)
  check('offers gaussian blur', texts.includes('background.blur'), joined)
  check('describes the active preset', texts.includes('background.solidDesc'), joined)
  check('does not describe an inactive preset', !texts.includes('background.blurDesc'), joined)

  const glass = renderEntry(page, pageState({ ...baseState, backgroundStyle: 'glass' }))
  check('describes the configured preset', textsOf(glass.tree).includes('background.glassDesc'), textsOf(glass.tree).join('|'))
  check('glass is the checked option', bgOptions(glass.tree).filter((label) => inputOf(label)?.props.checked === true).map((label) => inputOf(label).props.value).join() === 'glass')
  const unknown = renderEntry(page, pageState({ ...baseState, backgroundStyle: 'neon' }))
  check('an unknown Host value falls back to solid', textsOf(unknown.tree).includes('background.solidDesc'), textsOf(unknown.tree).join('|'))

  const offline = renderEntry(page, pageState(baseState, { offline: true }))
  check('cannot change appearance while offline', presetDisabled(offline.tree).length === 3 && presetDisabled(offline.tree).every((disabled) => disabled === true))
  const locked = renderEntry(page, pageState({ ...baseState, phase: 'executing' }))
  check('cannot change appearance during execution', presetDisabled(locked.tree).every((disabled) => disabled === true))
  const busy = renderEntry(page, pageState(baseState, { busy: true }))
  check('cannot stack appearance writes', presetDisabled(busy.tree).every((disabled) => disabled === true))
  check('the two mode radios are unchanged', modeRadiosOf(appearance.tree).length === 2)
}

console.log('\n=== background presets: countdown carries the style ===')
{
  const counting = (style) => ({
    data: { ...baseState, phase: 'counting', remainingSeconds: 45, countdownSeconds: 60, deadline: null, backgroundStyle: style },
    offline: false, busy: false, note: null,
  })
  const scrimFor = (style) => findElement(renderEntry(countdown, counting(style)).tree, (n) => n.props['aria-modal'] === true)
  check('solid is applied', scrimFor('solid')?.props['data-background'] === 'solid')
  check('glass is applied', scrimFor('glass')?.props['data-background'] === 'glass')
  check('blur is applied', scrimFor('blur')?.props['data-background'] === 'blur')
  check('a missing style falls back to solid', scrimFor(undefined)?.props['data-background'] === 'solid')
  check('an unknown style falls back to solid', scrimFor('neon')?.props['data-background'] === 'solid')
}

console.log('\n=== background presets: CSS and runtime wiring ===')
{
  const css = require('node:fs').readFileSync(process.argv[2] ?? require('node:path').join(__dirname, '..', 'client.js'), 'utf8')
  check('glass preset is defined', css.includes('.ipa-scrim[data-background=glass]'))
  check('blur preset is defined', css.includes('.ipa-scrim[data-background=blur]'))
  check('each tile previews its own countdown window', css.includes('.ipa-preset[data-preset=glass] .ipa-presetPanel') && css.includes('.ipa-preset[data-preset=blur] .ipa-presetPanel'))
  check('glass blurs the backdrop', css.includes('backdrop-filter:blur(22px)'))
  check('blur uses a heavier gaussian radius', css.includes('backdrop-filter:blur(34px)'))
  check('translucency uses color-mix with a solid fallback', css.includes('color-mix(in srgb,var(--dsw-alias-bg-overlay) 66%,transparent)'))
  check('the active preset is drawn with a ring, not a layer-token difference', css.includes('.ipa-preset:has(> :checked){border-color:var(--ipa-accent);box-shadow:0 0 0 1px var(--ipa-accent)}'))
  check('blur scopes its dark tokens to the overlay subtree', css.includes('--dsw-alias-label-primary:#f3f5f9'))
  check('all three presets are recognized', JSON.stringify(moduleObj.internals.BACKGROUND_STYLES) === '["solid","glass","blur"]')
  check('normalizeBackground rejects unknown values', moduleObj.internals.normalizeBackground('neon') === 'solid' && moduleObj.internals.normalizeBackground('blur') === 'blur')
  const injected = byKey('idle-power').inject()
  check('page receives the setBackground action', typeof injected.setBackground === 'function')
  check('page still receives setMode', typeof injected.setMode === 'function')
}


;(async () => {
  console.log('\n=== multi-screen: best-effort mirror windows ===')
  const makeEl = () => ({
    style: { cssText: '' }, children: [], textContent: '', type: '',
    appendChild(child) { this.children.push(child) },
    addEventListener() {},
  })
  const fakeWin = () => ({
    document: { title: '', body: makeEl(), createElement: () => makeEl() },
    moveTo() {}, resizeTo() {}, close() { this.closed = true }, addEventListener() {},
  })
  const text = { title: 'mirror', unit: 's', cancel: 'Cancel', hint: 'hint' }
  const primary = { availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1080 }
  const secondary = { availLeft: -1920, availTop: -120, availWidth: 2560, availHeight: 1440 }
  windowStub.getScreenDetails = async () => ({ currentScreen: primary, screens: [primary, secondary] })

  const seen = []
  const opened = await moduleObj.internals.openMirrorWindows({
    text,
    open: (url, name, features) => { seen.push({ url, name, features }); return fakeWin() },
  })
  check('opens one mirror for the other screen', opened.handles.length === 1, String(opened.handles.length))
  check('none were blocked', opened.blocked === 0, String(opened.blocked))
  check('mirrors are about:blank, not a new Host route', seen[0]?.url === 'about:blank', seen[0]?.url)
  check('places the mirror on the other screen', seen[0]?.features.includes('left=-1920'), seen[0]?.features)
  const handle = opened.handles[0]
  check('mirror has a cancel button', handle.button.textContent === 'Cancel', handle.button.textContent)
  check('mirror body is built without an inline script', handle.win.document.body.children.length >= 6, String(handle.win.document.body.children.length))
  handle.count.textContent = '0'
  check('the opener can drive the mirror digits', handle.count.textContent === '0')

  const denied = await moduleObj.internals.openMirrorWindows({ text, open: () => null })
  check('a denied window.open degrades without throwing', denied.handles.length === 0 && denied.blocked >= 1, JSON.stringify({ handles: denied.handles.length, blocked: denied.blocked }))

  delete windowStub.getScreenDetails
  const plain = await moduleObj.internals.openMirrorWindows({ text, open: () => fakeWin() })
  check('without screen details it still opens one draggable mirror', plain.handles.length === 1 && plain.plain === true, JSON.stringify({ n: plain.handles.length, plain: plain.plain }))

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`)
  process.exit(failures === 0 ? 0 : 1)
})()
