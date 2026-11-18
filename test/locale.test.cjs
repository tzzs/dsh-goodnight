// Hold the two dictionaries to the product name. A copy change is a rename of
// every user-visible label, and a rename silently misses values, so this file
// renders the real components with the real dictionaries and reads the text
// back. Run with --dump to print every string each surface shows.
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

const source = fs.readFileSync(process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : path.join(__dirname, '..', 'client.js'), 'utf8')
const dump = process.argv.includes('--dump')

let cursor = 0
let slots = []
const beginComponent = () => { cursor = 0; slots = [] }
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
  useRef(value) { cursor++; return { current: value } },
}

let factory = null
const listeners = { keydown: [], pointerdown: [] }
const windowStub = {
  __ModuleLoader__: { load: (entry) => { factory = entry.factory } },
  addEventListener(type, fn) { (listeners[type] ??= []).push(fn) },
  removeEventListener() {},
  innerWidth: 1440,
  innerHeight: 900,
}
const documentStub = {
  title: '',
  querySelector: () => null,
  createElement: () => ({ dataset: {}, remove() {} }),
  head: { appendChild() {} },
  body: { appendChild() {}, classList: { add() {}, remove() {} } },
}
vm.runInContext(source, vm.createContext({
  window: windowStub,
  document: documentStub,
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
  console,
  setInterval: () => 1,
  clearInterval() {},
  setTimeout: () => 1,
  clearTimeout() {},
  Date,
  JSON,
  Promise,
}), { filename: 'client.js' })

const moduleObj = factory((spec) => {
  if (spec === 'react') return React
  throw new Error('unexpected require: ' + spec)
})

const registered = []
let dictionaries = null
moduleObj.apply({
  effect(fn) { fn(); return () => {} },
  get: () => undefined,
  locale: {
    register(namespace, value) { dictionaries = value; return () => {} },
    bind: () => (key) => key,
  },
  slots: {
    inject: (name, callback) => { callback(); return () => {} },
    register(options, component) {
      registered.push({ id: options.id, key: options.key, label: options.label, component })
      return () => {}
    },
  },
})

function renderNode(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number') return { kind: 'text', text: String(node) }
  if (Array.isArray(node)) return node.map(renderNode).filter(Boolean)
  if (typeof node.type === 'function') {
    beginComponent()
    return renderNode(node.type({ ...node.props, children: node.children }))
  }
  return {
    kind: 'element',
    tag: node.type,
    props: node.props,
    children: node.children.map(renderNode).filter(Boolean),
  }
}

function textsOf(tree, out = []) {
  if (tree === null) return out
  if (Array.isArray(tree)) { for (const child of tree) textsOf(child, out); return out }
  if (tree.kind === 'text') { out.push(tree.text); return out }
  for (const child of tree.children) textsOf(child, out)
  return out
}

const byKey = (key) => registered.find((entry) => entry.key === key)
const byId = (id) => registered.find((entry) => entry.id === id)

const baseData = {
  supported: true,
  platform: 'win32',
  phase: 'idle',
  mode: 'hibernate',
  backgroundStyle: 'solid',
  countdownColor: null,
  countdownSeconds: 60,
  quietSeconds: 20,
  remainingSeconds: 0,
  quietRemainingSeconds: 0,
  deadline: null,
  fullscreenOnWait: false,
  stayAwake: true,
  busy: { available: true, agentsRunning: 0, inboxPending: 0, jobsRunning: 0, total: 0 },
  error: null,
  lastExecution: null,
}

const store = (data) => ({ data: { ...baseData, ...data }, ready: true, offline: false, busy: false, note: null, noteCode: null, notePhase: null })

const surfaces = {
  rail: () => registered.find((entry) => entry.id === 'idle-power').label(),
  pageIdle: () => renderNode(React.createElement(byKey('idle-power').component, {
    usePower: (selector) => (typeof selector === 'function' ? selector(store({})) : store({})),
    t: (key) => dictionaries.zh[key] ?? key,
    arm: async () => true,
    cancel: async () => true,
    setMode: async () => true,
    setBackground: async () => true,
    setColor: async () => true,
    setFullscreenOnWait: async () => true,
    setStayAwake: async () => true,
    openPreview: () => {},
    refresh: async () => true,
  })),
  countdown: () => renderNode(React.createElement(byId('dsh-idle-power.countdown').component, {
    usePower: (selector) => {
      const value = store({ phase: 'counting', remainingSeconds: 45, deadline: null })
      return typeof selector === 'function' ? selector(value) : value
    },
    t: (key) => dictionaries.zh[key] ?? key,
    cancel: async () => true,
  })),
  wait: () => renderNode(React.createElement(byId('dsh-idle-power.wait').component, {
    usePower: (selector) => {
      const value = store({ phase: 'armed', fullscreenOnWait: true, quietRemainingSeconds: 8 })
      return typeof selector === 'function' ? selector(value) : value
    },
    t: (key) => dictionaries.zh[key] ?? key,
    cancel: async () => true,
    dismiss: () => {},
  })),
}

let failures = 0
function check(label, condition, detail) {
  if (condition) console.log(`  PASS  ${label}`)
  else { failures += 1; console.log(`  FAIL  ${label}${detail === undefined ? '' : ` ${detail}`}`) }
}

if (dictionaries === null) {
  console.log('  FAIL  the client registers its dictionaries')
  process.exit(1)
}

const [zh, en] = [dictionaries.zh, dictionaries.en]
const keysOf = (dict) => Object.keys(dict).sort()
const placeholders = (value) => (String(value).match(/%s/g) ?? []).length

if (dump) {
  console.log('# dictionaries')
  for (const key of keysOf(zh)) console.log(`zh ${key} = ${zh[key]}`)
  for (const key of keysOf(en)) console.log(`en ${key} = ${en[key]}`)
  for (const [name, render] of Object.entries(surfaces)) {
    const value = render()
    console.log(`# surface ${name}`)
    if (typeof value === 'string') { console.log(value); continue }
    const texts = textsOf(value)
    for (const text of [...new Set(texts)]) if (!/^\s*$/.test(text)) console.log(text)
  }
  process.exit(0)
}

console.log('\n=== dictionaries cover both languages ===')
check('zh and en define the same keys', keysOf(zh).join('|') === keysOf(en).join('|'),
  kevs(keysOf(zh), keysOf(en)))
check('every value carries the same placeholders in both languages',
  keysOf(zh).every((key) => placeholders(zh[key]) === placeholders(en[key])),
  keysOf(zh).filter((key) => placeholders(zh[key]) !== placeholders(en[key])).join(','))

console.log('\n=== the product name is the one the docs promise ===')
const retired = ['预约关机', '预约休眠', '空闲关机', '空闲电源', 'Scheduled power', 'Schedule shutdown',
  'Schedule hibernation', 'Idle power', 'Idle Shutdown']
const offenders = []
for (const [language, dict] of [['zh', zh], ['en', en]]) {
  for (const key of keysOf(dict)) {
    if (retired.some((name) => String(dict[key]).includes(name))) offenders.push(`${language}.${key}`)
  }
}
check('no label still uses a retired name', offenders.length === 0, offenders.join(','))
check('zh names the plugin 晚安', zh['rail.label'] === '晚安' && zh['page.title'] === '晚安', zh['rail.label'])
check('en names the plugin Goodnight', en['rail.label'] === 'Goodnight' && en['page.title'] === 'Goodnight', en['rail.label'])

console.log('\n=== every surface renders resolved text ===')
const knownKeys = new Set([...keysOf(zh), ...keysOf(en)])
check('rail label resolves through the locale', surfaces.rail() === 'rail.label', String(surfaces.rail()))
for (const [name, render] of Object.entries(surfaces)) {
  if (name === 'rail') continue
  const texts = textsOf(render()).filter((text) => !/^\s*$/.test(text))
  check(`${name} renders something`, texts.length > 0)
  const unresolved = texts.filter((text) => knownKeys.has(text))
  check(`${name} resolves every key it shows`, unresolved.length === 0, unresolved.join(','))
}

function kevs(a, b) {
  return [...a.filter((key) => !b.includes(key)), ...b.filter((key) => !a.includes(key))].join(',')
}

console.log(failures === 0 ? '\nlocale: ok' : `\nlocale: ${failures} failure(s)`)
process.exit(failures === 0 ? 0 : 1)
