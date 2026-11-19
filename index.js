/**
 * Host half of the dsh-goodnight bundle.
 *
 * Watches every live agent and every background job in THIS Host process. Once
 * the whole process has stayed quiet for the configured grace period, it runs a
 * visible countdown in the browser half and then hibernates or powers off.
 *
 * The reservation lives in this process only and is never written to a Session
 * log: a reservation that does not survive a Host restart is the safe default,
 * because a restart means somebody is at the machine.
 */

export const name = 'dsh-goodnight'

/** `agents` is resolved lazily so a profile without the job registry still works. */
export const inject = ['webServer', 'connection', 'subprocess']

const STATE_PATH = '/goodnight/state'
const ARM_PATH = '/goodnight/arm'
const CANCEL_PATH = '/goodnight/cancel'
const MODE_PATH = '/goodnight/mode'
const BACKGROUND_PATH = '/goodnight/background'
const COLOR_PATH = '/goodnight/color'
const FULLSCREEN_PATH = '/goodnight/fullscreen'
const AWAKE_PATH = '/goodnight/awake'
const FORCE_PATH = '/goodnight/force'

const PHASE_IDLE = 'idle'
const PHASE_ARMED = 'armed'
const PHASE_COUNTING = 'counting'
const PHASE_EXECUTING = 'executing'
const PHASE_FAILED = 'failed'

const MODE_HIBERNATE = 'hibernate'
const MODE_SHUTDOWN = 'shutdown'

const BACKGROUND_SOLID = 'solid'
const BACKGROUND_GLASS = 'glass'
const BACKGROUND_BLUR = 'blur'
const BACKGROUND_STYLES = [BACKGROUND_SOLID, BACKGROUND_GLASS, BACKGROUND_BLUR]

const DEFAULT_COUNTDOWN_SECONDS = 60
const DEFAULT_QUIET_SECONDS = 20
// Ten minutes of an unchanging blocker is long enough to call it frozen.
const DEFAULT_STUCK_AFTER_SECONDS = 600
const MAX_BODY_BYTES = 64 * 1024
/**
 * A gap this large between the deadline and the next tick means this process was
 * frozen or the machine was suspended, not that a timer merely ran late. Firing
 * a shutdown at the exact moment a laptop wakes is a surprise, so the watch is
 * re-armed instead and the whole quiet window has to happen again.
 */
const RESUME_GAP_MS = 5 * 1000

/** Clamp a configured integer into range, falling back to the default. */
function boundedInteger(value, fallback, min, max) {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
	return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * Only known background presets are accepted. A typo must not produce a blank
 * or unreadable overlay, so anything else falls back to the opaque surface.
 */
function normalizedBackground(value, fallback) {
	return BACKGROUND_STYLES.includes(value) ? value : fallback
}

const COLOR_PATTERN = /^#[0-9a-f]{6}$/

/**
 * A custom countdown colour is optional: `null` keeps the overlay on the Host
 * theme tokens, which stay correct in both themes and forced-colours mode.
 * Only a plain opaque hex is accepted, so the client can always compute a
 * readable ink from it.
 */
function normalizedColor(value, fallback = null) {
	if (value === null || value === undefined) return fallback
	if (typeof value !== 'string') return fallback
	const lowered = value.trim().toLowerCase()
	return COLOR_PATTERN.test(lowered) ? lowered : fallback
}

/**
 * Request-body colour parsing: `null` clears the override, a hex sets it, and
 * anything else is a 400. Kept separate from `normalizedColor` because a body
 * that omits the field must be rejected, not defaulted.
 */
function parseColorInput(value) {
	if (value === null) return { ok: true, color: null }
	if (typeof value !== 'string') return { ok: false }
	const lowered = value.trim().toLowerCase()
	return COLOR_PATTERN.test(lowered) ? { ok: true, color: lowered } : { ok: false }
}

/**
 * Windows drops to the lock screen after the display idles out, and an idle
 * timeout can suspend the whole machine. A suspended Host cannot fire its own
 * countdown, so a pending reservation has to keep the machine awake.
 *
 * `SetThreadExecutionState` is per-thread and clears when that thread ends, so
 * this has to be a process that outlives a single call: the helper asserts the
 * state once, re-asserts on a timer, and is terminated the moment it is no
 * longer needed. The flags are ES_CONTINUOUS | ES_SYSTEM_REQUIRED |
 * ES_DISPLAY_REQUIRED (0x80000003 = 2147483651): no sleep, and no display-off —
 * which is what raises the lock screen in the first place.
 */
const AWAKE_REFRESH_MS = 20 * 1000

function awakeCommand(platform) {
	if (platform === 'win32') {
		const script = [
			"Add-Type -Namespace DshIdlePower -Name Native -MemberDefinition '[System.Runtime.InteropServices.DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint esFlags);'",
			// Windows PowerShell 5.1 parses 0x80000003 as a negative Int32, which the
			// uint parameter refuses; the decimal form cast to uint32 works everywhere.
			'[void][DshIdlePower.Native]::SetThreadExecutionState([uint32]2147483651)',
			'while ($true) { Start-Sleep -Milliseconds ' + AWAKE_REFRESH_MS + '; [void][DshIdlePower.Native]::SetThreadExecutionState([uint32]2147483651) }',
		].join('\n')
		return { program: 'powershell', args: ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script] }
	}
	if (platform === 'darwin') return { program: 'caffeinate', args: ['-d', '-i', '-m', '-s'] }
	// Linux: the inhibitor holds an idle/sleep lock for as long as it runs.
	return {
		program: 'systemd-inhibit',
		args: ['--what=idle:sleep', '--why=dsh-goodnight: a reservation is pending', 'sleep', 'infinity'],
	}
}

/** One plain-JSON reply. Live state is never cached. */
function sendJson(res, status, payload) {
	res.statusCode = status
	res.setHeader('content-type', 'application/json; charset=utf-8')
	res.setHeader('cache-control', 'no-store')
	res.end(JSON.stringify(payload))
}

/** Refuse a method the route does not serve. */
function sendMethodNotAllowed(res, allow) {
	res.statusCode = 405
	res.setHeader('allow', allow)
	res.end()
}

/** Bound one request body in memory; null means the ceiling was passed. */
async function readBoundedBody(req) {
	const chunks = []
	let size = 0
	for await (const chunk of req) {
		size += chunk.byteLength
		if (size > MAX_BODY_BYTES) {
			req.resume()
			return null
		}
		chunks.push(chunk)
	}
	return Buffer.concat(chunks, size).toString('utf8')
}

/** Parse an optional `{ mode }` body; `{}` means "keep the current mode". */
function parseModeBody(text, currentMode) {
	if (text.trim() === '') return { mode: currentMode }
	let body
	try {
		body = JSON.parse(text)
	} catch {
		return undefined
	}
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined
	if (body.mode === undefined) return { mode: currentMode }
	if (body.mode !== MODE_HIBERNATE && body.mode !== MODE_SHUTDOWN) return undefined
	return { mode: body.mode }
}

/**
 * Host half entry point.
 *
 * `config` is the user-facing plugin configuration from `cordis.patch.yml`, so
 * it must stay free of knobs that only exist for testing. The platform is
 * therefore injected separately: Cordis calls `apply(ctx, config)` and the
 * real platform is read from `process.platform`; a test passes
 * `{ platform: 'linux' }` to exercise the unsupported-platform branch on any
 * machine.
 *
 * @param ctx - The plugin context.
 * @param config - User configuration from the plugin row.
 * @param environment - Optional overrides, currently only `platform`.
 */
export function apply(ctx, config, environment = {}) {
	const options = {
		countdownSeconds: boundedInteger(config?.countdownSeconds, DEFAULT_COUNTDOWN_SECONDS, 5, 3600),
		quietSeconds: boundedInteger(config?.quietSeconds, DEFAULT_QUIET_SECONDS, 3, 3600),
		// A blocker that never clears pins the reservation forever, so the panel
		// starts offering a way past it after this long. It never skips on its own.
		stuckAfterSeconds: boundedInteger(config?.stuckAfterSeconds, DEFAULT_STUCK_AFTER_SECONDS, 30, 86_400),
		// Default is a real power-off: 关机 unless hibernate is asked for.
		defaultMode: config?.defaultMode === MODE_HIBERNATE ? MODE_HIBERNATE : MODE_SHUTDOWN,
		// Default is the opaque surface: its contrast never depends on what is
		// behind the window. The panel can override it for this Host's lifetime.
		backgroundStyle: normalizedBackground(config?.backgroundStyle, BACKGROUND_SOLID),
		// `null` means "follow the Host theme"; a hex pins the solid surface.
		countdownColor: normalizedColor(config?.countdownColor, null),
		// Off by default: a reservation that hijacks the whole screen while the
		// user is still working is a surprise, so it has to be asked for.
		fullscreenOnWait: config?.fullscreenOnWait === true,
		// On by default: without it a pending reservation can be lost to the lock
		// screen, which is the exact failure this plugin exists to prevent.
		stayAwake: config?.stayAwake !== false,
		shutdownCommand:
			typeof config?.shutdownCommand === 'string' && config.shutdownCommand.length > 0
				? config.shutdownCommand
				: 'shutdown',
		// The platform decides whether a power backend exists at all.
		platform:
			typeof environment?.platform === 'string' ? environment.platform : process.platform,
	}
	const supported = options.platform === 'win32'

	let phase = PHASE_IDLE
	let mode = options.defaultMode
	let backgroundStyle = options.backgroundStyle
	let countdownColor = options.countdownColor
	let fullscreenOnWait = options.fullscreenOnWait
	let awakeHandle = null
	let awakeStarting = false
	let quietSince = null
	// When the current blocker appeared, plus its shape, so the UI can say how
	// long this exact combination has been sitting there unchanged.
	let blockedSince = null
	let blockedShape = null
	let deadline = null
	let error = null
	let lastExecution = null
	let executing = false
	let revision = 0
	let disposed = false

	const executionConflict = () => ({ ok: false, code: 'execution-in-progress', message: 'the power command is already executing' })
	const superseded = () => ({ ok: false, code: 'reservation-changed', message: 'the reservation changed; please try again' })

	/**
	 * Count everything this Host is still doing: agent turns, queued inbox work,
	 * and background jobs. Workflow children and subagents are ordinary agents in
	 * `agents.list()`, so they are covered without a separate ledger. Mirrors the
	 * shipped `hasDesktopActiveTasks` predicate in `dsh-desktop-host`.
	 */
	function countBusy() {
		const agents = ctx.get('agents')
		const jobs = ctx.get('jobs')
		const live = agents === undefined ? [] : agents.list()
		let agentsRunning = 0
		let inboxPending = 0
		for (const agent of live) {
			if (agent.status === 'running') agentsRunning += 1
			const inbox = agent.inbox
			inboxPending += (inbox?.nextTurn?.length ?? 0) + (inbox?.nextStep?.length ?? 0)
		}
		let jobsRunning = 0
		if (jobs !== undefined) {
			const seen = new Set()
			for (const owner of [undefined, ...live.map((agent) => agent.id)]) {
				for (const job of jobs.list(owner)) {
					if (seen.has(job.id)) continue
					seen.add(job.id)
					if (job.status === 'running' || job.status === 'stopping') jobsRunning += 1
				}
			}
		}
		return {
			available: agents !== undefined,
			agentsRunning,
			inboxPending,
			jobsRunning,
			total: agentsRunning + inboxPending + jobsRunning,
		}
	}

	/**
	 * Remember how long the current blocker has been sitting there. The shape is
	 * the breakdown, not just the total: one job turning into two different jobs
	 * is new information, so the clock has to restart rather than claim the same
	 * blocker has been frozen for an hour.
	 */
	function noteBlocked(busy, now) {
		const shape = `${busy.available ? 'up' : 'down'}:${busy.agentsRunning}:${busy.inboxPending}:${busy.jobsRunning}`
		if (shape === blockedShape) return
		blockedShape = shape
		blockedSince = now
	}

	/** Snapshot for the browser half. `deadline` lets it tick locally between polls. */
	function stateSnapshot() {
		const busy = countBusy()
		const now = Date.now()
		return {
			supported,
			platform: options.platform,
			phase,
			mode,
			backgroundStyle,
			countdownColor,
			fullscreenOnWait,
			stayAwake: options.stayAwake,
			countdownSeconds: options.countdownSeconds,
			quietSeconds: options.quietSeconds,
			stuckAfterSeconds: options.stuckAfterSeconds,
			blockedForSeconds:
				blockedSince === null || busy.total === 0 ? 0 : Math.max(0, Math.floor((now - blockedSince) / 1000)),
			remainingSeconds: deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000)),
			quietRemainingSeconds:
				quietSince === null ? 0 : Math.max(0, Math.ceil((quietSince + options.quietSeconds * 1000 - now) / 1000)),
			deadline,
			busy,
			error,
			lastExecution,
		}
	}

	/** Whether the machine should be held awake right now. */
	function awakeWanted() {
		return options.stayAwake && (phase === PHASE_ARMED || phase === PHASE_COUNTING)
	}

	/**
	 * Start or stop the keep-awake helper so it matches the current phase. Called
	 * after every transition; it is a no-op when the state already matches, which
	 * matters because the watcher runs this once a second.
	 */
	async function syncAwake() {
		if (!awakeWanted()) {
			const handle = awakeHandle
			awakeHandle = null
			if (handle !== null) {
				try {
					await handle.terminate()
				} catch {
					/* it already exited */
				}
			}
			return
		}
		if (awakeHandle !== null || awakeStarting) return
		awakeStarting = true
		try {
			const spec = awakeCommand(options.platform)
			const executable = await ctx.subprocess.resolveExecutable(spec.program)
			// The reservation can end while PATH resolution yields.
			if (disposed || !awakeWanted()) return
			const handle = ctx.subprocess.spawn({
				argv: [executable, ...spec.args],
				cwd: process.cwd(),
				stdio: { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' },
				graceMs: 2000,
			})
			// It runs until we terminate it; a failure here must not surface as an
			// unhandled rejection in the Host.
			Promise.resolve(handle.done).catch(() => {})
			if (disposed || !awakeWanted()) {
				try {
					await handle.terminate()
				} catch {
					/* nothing to clean up */
				}
				return
			}
			awakeHandle = handle
		} catch {
			awakeHandle = null
		} finally {
			awakeStarting = false
		}
	}

	/** Leave every waiting phase and forget the reservation. */
	function reset() {
		revision += 1
		phase = PHASE_IDLE
		quietSince = null
		blockedSince = null
		blockedShape = null
		deadline = null
		error = null
		void syncAwake()
	}

	/**
	 * Advance the state machine. Called once a second and again on every activity
	 * event, so a new task cancels a running countdown promptly instead of one
	 * tick later.
	 */
	function evaluate(now = Date.now()) {
		if (disposed || (phase !== PHASE_ARMED && phase !== PHASE_COUNTING)) return
		const busy = countBusy()
		// Missing registries are unknown activity, never proof of idleness.
		if (!busy.available || busy.total > 0) {
			if (phase === PHASE_COUNTING) revision += 1
			phase = PHASE_ARMED
			deadline = null
			quietSince = null
			noteBlocked(busy, now)
			return
		}
		blockedSince = null
		blockedShape = null
		if (phase === PHASE_ARMED) {
			if (quietSince === null) {
				quietSince = now
				return
			}
			if (now - quietSince >= options.quietSeconds * 1000) {
				phase = PHASE_COUNTING
				deadline = now + options.countdownSeconds * 1000
				quietSince = null
			}
			return
		}
		if (now >= deadline) {
			if (now - deadline > RESUME_GAP_MS) {
				revision += 1
				phase = PHASE_ARMED
				deadline = null
				quietSince = now
				ctx.logger.info('dsh-goodnight: woke past the countdown deadline; re-armed instead of executing')
				return
			}
			void execute()
		}
	}

	/** Run the reserved power action. A non-zero exit or a spawn failure is reported. */
	async function execute() {
		if (executing || disposed) return
		executing = true
		const attempt = revision
		const actionMode = mode
		try {
			const executable = await ctx.subprocess.resolveExecutable(options.shutdownCommand)
			if (disposed || revision !== attempt || phase !== PHASE_COUNTING) return
			const now = Date.now()
			if (now - deadline > RESUME_GAP_MS) {
				evaluate(now)
				return
			}
			// Resolving PATH may yield while new work arrives. Recheck immediately
			// before spawn, with no asynchronous boundary after this check.
			const busy = countBusy()
			if (!busy.available || busy.total > 0) {
				evaluate()
				return
			}
			phase = PHASE_EXECUTING
			deadline = null
			void syncAwake()
			const argv =
				actionMode === MODE_HIBERNATE
					? [executable, '/h', '/f']
					: [executable, '/s', '/t', '0', '/f', '/c', 'DeepSeek Harness: all tasks finished']
			const handle = ctx.subprocess.spawn({
				argv,
				cwd: process.cwd(),
				stdio: {
					stdin: 'ignore',
					stdout: { maxBytes: 16 * 1024 },
					stderr: { maxBytes: 16 * 1024 },
				},
				graceMs: 5000,
			})
			const outcome = await handle.done
			const stderr = handle.collected.stderr?.readFrom(0).text ?? ''
			if (outcome.exitCode !== 0) {
				const detail = stderr.trim()
				phase = PHASE_FAILED
				error = `${options.shutdownCommand} exited ${String(outcome.exitCode)}${detail.length > 0 ? `: ${detail}` : ''}`
				lastExecution = { mode: actionMode, at: Date.now(), ok: false }
				return
			}
			ctx.logger.info(`dsh-goodnight: ${actionMode} command accepted`)
			phase = PHASE_IDLE
			error = null
			lastExecution = { mode: actionMode, at: Date.now(), ok: true }
		} catch (failure) {
			if (disposed || revision !== attempt) return
			deadline = null
			phase = PHASE_FAILED
			error = failure instanceof Error ? failure.message : String(failure)
			lastExecution = { mode: actionMode, at: Date.now(), ok: false }
			ctx.logger.warn(`dsh-goodnight: ${actionMode} failed: ${error}`)
		} finally {
			executing = false
		}
	}

	/**
	 * Arm a reservation, refusing a machine or command that cannot honour it.
	 * `entryRevision` is the revision observed when the request arrived: if the
	 * reservation changed while the body was still uploading, this request is
	 * stale and must not recreate it after a later cancel.
	 */
	async function arm(requestedMode, entryRevision) {
		if (entryRevision !== undefined && revision !== entryRevision) return superseded()
		if (phase === PHASE_EXECUTING) return executionConflict()
		if (disposed) return superseded()
		if (!supported) {
			return { ok: false, code: 'unsupported-platform', message: `unsupported platform: ${options.platform}` }
		}
		if (ctx.get('agents') === undefined) {
			return { ok: false, code: 'agents-unavailable', message: 'the agent registry is unavailable' }
		}
		const attempt = ++revision
		try {
			await ctx.subprocess.resolveExecutable(options.shutdownCommand)
		} catch (failure) {
			if (disposed || revision !== attempt) return superseded()
			return {
				ok: false,
				code: 'command-unavailable',
				message: failure instanceof Error ? failure.message : String(failure),
			}
		}
		if (disposed || revision !== attempt) return superseded()
		if (phase === PHASE_EXECUTING) return executionConflict()
		if (ctx.get('agents') === undefined) {
			return { ok: false, code: 'agents-unavailable', message: 'the agent registry is unavailable' }
		}
		// Invalidate any countdown lookup that started while validation yielded.
		revision += 1
		mode = requestedMode
		phase = PHASE_ARMED
		quietSince = null
		deadline = null
		error = null
		ctx.logger.info(`dsh-goodnight: armed for ${mode} after ${options.quietSeconds}s quiet`)
		// Keep the machine awake for as long as this reservation is pending; a
		// sleeping Host cannot fire its own countdown.
		void syncAwake()
		return { ok: true }
	}

	/** The one fence every route runs first: Host/Origin trust plus browser authentication. */
	function rejected(req, res) {
		const connection = ctx.get('connection')
		const rejection = connection === undefined ? 503 : connection.requestRejection(req)
		if (rejection === undefined) return false
		res.statusCode = rejection
		res.end()
		return true
	}

	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: STATE_PATH,
		handler: (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'GET') {
				sendMethodNotAllowed(res, 'GET')
				return
			}
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: GET ${STATE_PATH}`)

	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: ARM_PATH,
		handler: async (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			// Take the revision before the awaited body read: a cancel that lands
			// while the body is still arriving must win over this arm.
			const entryRevision = revision
			const essence = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
			if (essence !== 'application/json') {
				sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
				return
			}
			const text = await readBoundedBody(req)
			if (text === null) {
				sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
				return
			}
			const parsed = parseModeBody(text, mode)
			if (parsed === undefined) {
				sendJson(res, 400, { code: 'bad-request', message: 'body must be {"mode":"hibernate"|"shutdown"}' })
				return
			}
			const outcome = await arm(parsed.mode, entryRevision)
			if (!outcome.ok) {
				sendJson(res, 409, { code: outcome.code, message: outcome.message })
				return
			}
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${ARM_PATH}`)

	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: MODE_PATH,
		handler: async (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			const essence = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
			if (essence !== 'application/json') {
				sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
				return
			}
			const text = await readBoundedBody(req)
			if (text === null) {
				sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
				return
			}
			// A mode change must be explicit: an empty body would otherwise read
			// as "keep the current mode" and do nothing.
			let parsed
			try {
				parsed = JSON.parse(text)
			} catch {
				parsed = undefined
			}
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				sendJson(res, 400, { code: 'bad-request', message: 'body must be {"mode":"hibernate"|"shutdown"}' })
				return
			}
			if (parsed.mode !== MODE_HIBERNATE && parsed.mode !== MODE_SHUTDOWN) {
				sendJson(res, 400, { code: 'bad-request', message: 'mode must be "hibernate" or "shutdown"' })
				return
			}
			if (phase === PHASE_EXECUTING) {
				sendJson(res, 409, executionConflict())
				return
			}
			if (phase === PHASE_ARMED || phase === PHASE_COUNTING) {
				sendJson(res, 409, superseded())
				return
			}
			revision += 1
			mode = parsed.mode
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${MODE_PATH}`)

	/**
	 * A cosmetic preference, kept on the Host like `mode`, so the choice is
	 * shared by every window looking at this Host and survives a page reload.
	 * It deliberately does NOT bump `revision`: an appearance change must never
	 * make a concurrent arm upload look superseded.
	 */
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: BACKGROUND_PATH,
		handler: async (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			const essence = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
			if (essence !== 'application/json') {
				sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
				return
			}
			const text = await readBoundedBody(req)
			if (text === null) {
				sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
				return
			}
			let parsed
			try {
				parsed = JSON.parse(text)
			} catch {
				parsed = undefined
			}
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || !BACKGROUND_STYLES.includes(parsed.backgroundStyle)) {
				sendJson(res, 400, { code: 'bad-request', message: 'backgroundStyle must be "solid"|"glass"|"blur"' })
				return
			}
			if (phase === PHASE_EXECUTING) {
				sendJson(res, 409, executionConflict())
				return
			}
			backgroundStyle = parsed.backgroundStyle
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${BACKGROUND_PATH}`)

	/**
	 * The same cosmetic-preference rules as the background style: shared by every
	 * window on this Host, never bumps `revision`, refused once executing.
	 */
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: COLOR_PATH,
		handler: async (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			const essence = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
			if (essence !== 'application/json') {
				sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
				return
			}
			const text = await readBoundedBody(req)
			if (text === null) {
				sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
				return
			}
			let parsed
			try {
				parsed = JSON.parse(text)
			} catch {
				parsed = undefined
			}
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				sendJson(res, 400, { code: 'bad-request', message: 'body must be {"color":"#rrggbb"|null}' })
				return
			}
			const next = parseColorInput(parsed.color)
			if (!next.ok) {
				sendJson(res, 400, { code: 'bad-request', message: 'color must be "#rrggbb" or null' })
				return
			}
			if (phase === PHASE_EXECUTING) {
				sendJson(res, 409, executionConflict())
				return
			}
			countdownColor = next.color
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${COLOR_PATH}`)

	/**
	 * Whether the waiting phase also takes the whole screen. Same cosmetic rules as
	 * the style and colour routes: shared per Host, refused while executing, no
	 * revision bump.
	 */
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: FULLSCREEN_PATH,
		handler: async (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			const essence = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
			if (essence !== 'application/json') {
				sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
				return
			}
			const text = await readBoundedBody(req)
			if (text === null) {
				sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
				return
			}
			let parsed
			try {
				parsed = JSON.parse(text)
			} catch {
				parsed = undefined
			}
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || typeof parsed.onWait !== 'boolean') {
				sendJson(res, 400, { code: 'bad-request', message: 'body must be {"onWait":boolean}' })
				return
			}
			if (phase === PHASE_EXECUTING) {
				sendJson(res, 409, executionConflict())
				return
			}
			fullscreenOnWait = parsed.onWait
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${FULLSCREEN_PATH}`)

	/** Whether a pending reservation keeps the machine awake. Cosmetic rules as above. */
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: AWAKE_PATH,
		handler: async (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			const essence = String(req.headers['content-type'] ?? '').split(';', 1)[0]?.trim().toLowerCase()
			if (essence !== 'application/json') {
				sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
				return
			}
			const text = await readBoundedBody(req)
			if (text === null) {
				sendJson(res, 413, { code: 'payload-too-large', message: 'request body is too large' })
				return
			}
			let parsed
			try {
				parsed = JSON.parse(text)
			} catch {
				parsed = undefined
			}
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || typeof parsed.on !== 'boolean') {
				sendJson(res, 400, { code: 'bad-request', message: 'body must be {"on":boolean}' })
				return
			}
			if (phase === PHASE_EXECUTING) {
				sendJson(res, 409, executionConflict())
				return
			}
			options.stayAwake = parsed.on
			void syncAwake()
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${AWAKE_PATH}`)

	// Skip a blocker the reader has decided is frozen. Deliberately manual: the
	// Host never decides on its own that a running task should be abandoned, and it
	// only accepts this while the reservation is still waiting to start.
	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: FORCE_PATH,
		handler: (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			if (phase === PHASE_EXECUTING) {
				sendJson(res, 409, executionConflict())
				return
			}
			if (phase !== PHASE_ARMED) {
				sendJson(res, 409, { code: 'not-waiting', message: 'nothing is waiting on a task right now' })
				return
			}
			// Only a real blocker can be skipped; an idle panel has nothing to force.
			const busy = countBusy()
			if (busy.available && busy.total === 0) {
				sendJson(res, 409, { code: 'not-blocked', message: 'no task is blocking the reservation' })
				return
			}
			revision += 1
			phase = PHASE_COUNTING
			quietSince = null
			deadline = Date.now() + options.countdownSeconds * 1000
			void syncAwake()
			ctx.logger.info('dsh-goodnight: skipping a stuck blocker on request')
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${FORCE_PATH}`)

	ctx.effect(() => ctx.webServer.register({
		kind: 'exact',
		path: CANCEL_PATH,
		handler: (req, res) => {
			if (rejected(req, res)) return
			if (req.method !== 'POST') {
				sendMethodNotAllowed(res, 'POST')
				return
			}
			if (phase === PHASE_EXECUTING) {
				sendJson(res, 409, executionConflict())
				return
			}
			reset()
			sendJson(res, 200, stateSnapshot())
		},
	}), `dsh-goodnight: POST ${CANCEL_PATH}`)

	// The one authoritative clock, plus event nudges so a countdown is voided as
	// soon as work reappears rather than up to a second later.
	ctx.effect(() => {
		const timer = setInterval(() => {
			evaluate()
			void syncAwake()
		}, 1000)
		return () => {
			disposed = true
			revision += 1
			clearInterval(timer)
			const handle = awakeHandle
			awakeHandle = null
			if (handle !== null) {
				try {
					void handle.terminate()
				} catch {
					/* the Host is going away */
				}
			}
		}
	}, 'dsh-goodnight: watcher')

	const nudge = () => {
		if (phase === PHASE_ARMED || phase === PHASE_COUNTING) evaluate()
	}
	ctx.on('agent/status', nudge)
	ctx.on('agent/inbox/inserted', nudge)
	ctx.on('agent/created', nudge)
	ctx.on('agent/disposed', nudge)

	ctx.effect(() => {
		const jobs = ctx.get('jobs')
		if (jobs === undefined) return () => {}
		return jobs.events.subscribe({ owners: 'all' }, nudge)
	}, 'dsh-goodnight: job events')
}
