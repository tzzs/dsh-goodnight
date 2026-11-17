window.__ModuleLoader__.load({
  id: 'dsh-idle-power',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef, useMemo } = React;

    const NS = 'dsh-idle-power';
    const ROUTE_STATE = 'idle-power/state';
    const ROUTE_ARM = 'idle-power/arm';
    const ROUTE_CANCEL = 'idle-power/cancel';
    const ROUTE_MODE = 'idle-power/mode';
    const ROUTE_BACKGROUND = 'idle-power/background';

    // ---------------------------------------------------------------- locale
    const zh = {
      'rail.label': '预约关机',
      'page.eyebrow': '空闲电源',
      'page.title': '预约关机',
      'page.subtitle': '等当前 DSH Host 的任务全部结束，再执行一次电源操作。',
      'page.refresh': '刷新状态',
      'page.retry': '重试',
      'page.armShutdown': '预约关机',
      'page.armHibernate': '预约休眠',
      'page.cancel': '取消预约',
      'foot.plan': '预约后：空闲 %s 秒 → 倒计时 %s 秒 → %s',
      'page.saving': '正在提交…',
      'page.loading': '正在读取状态…',
      'status.idle': '未预约',
      'status.waiting': '等待中',
      'status.counting': '倒计时中',
      'status.executing': '正在执行电源操作',
      'status.failed': '执行失败',
      'status.offline': '连不上插件 Host',
      'status.unsupported': '此插件只支持 Windows',
      'status.registryUnavailable': '智能体注册表不可用，已暂停倒计时',
      'status.tasksSuffix': ' 个任务在跑',
      'status.quietSuffix': ' 秒后开始倒计时',
      'status.countingSuffix': ' 秒后执行',
      'status.scheduledAt': '预计 %s 执行',
      'body.idle': '还没有预约。现在预约，会一直等到所有任务结束。',
      'body.waiting': '任务全部停下后开始倒计时。',
      'body.quiet': '任务已经停下，正在确认这段空闲。',
      'body.counting': '倒计时期间出现新任务会自动作废。',
      'body.executing': '电源操作已经发出，无法取消。',
      'body.failed': '电源操作没有成功，可以重新预约。',
      'body.offline': '状态读取失败，预约可能仍在执行；确认连接后再操作。',
      'body.registry': '找不到智能体注册表，无法判断任务是否结束，倒计时已暂停。',
      'body.unsupported': '只有 Windows 提供休眠和关机命令。',
      'section.mode': '电源操作',
      'section.modeHint': '倒计时归零后执行选中的操作。',
      'section.flow': '执行流程',
      'section.flowHint': '三步依次发生；倒计时期间出现新任务会自动作废。',
      'section.background': '倒计时背景',
      'section.backgroundHint': '只影响倒计时窗口的外观。',
      'section.notes': '说明',
      'mode.hibernate': '休眠',
      'mode.hibernateDesc': '内存快照落盘，等于断电；下次开机原样恢复窗口和未保存的内容。',
      'mode.shutdown': '关机',
      'mode.shutdownDesc': '倒计时结束后关闭 Windows，DSH 对话记录仍然保留。',
      'flow.idle': '持续空闲 %s 秒',
      'flow.idleDesc': '智能体、排队消息和后台任务都停下之后，再连续空闲这么久。',
      'flow.countdown': '可取消倒计时 %s 秒',
      'flow.countdownDesc': '占满整个窗口的倒计时，按 Esc 或点取消都能停下。',
      'flow.act': '执行电源操作',
      'flow.actDesc': '倒计时归零后执行休眠或关机，开始执行后无法再取消。',
      'metric.agents': '运行中的智能体',
      'metric.inbox': '排队消息',
      'metric.jobs': '后台任务',
      'metric.total': '任务合计',
      'hero.progress': '剩余时间',
      'note.scope': '关闭页面不会取消预约；只监测当前 Host，不监测其他应用或其他 Host。',
      'note.autoVoid': '倒计时期间任何新任务都会让本次预约自动作废。',
      'note.platform': '只有 Windows 提供休眠和关机命令。',
      'note.hostRestart': 'Host 重启会取消预约：重启说明有人回到了机器前。',
      'note.shutdown': '会强制关闭应用，未保存的内容可能丢失。请先保存其他应用的工作。',
      'note.hibernate': '休眠后按电源键会把整机内存读回来，开着的窗口都还在。',
      'background.solid': '纯色',
      'background.solidDesc': '不透明底色，文字对比度最高。',
      'background.glass': '毛玻璃',
      'background.glassDesc': '半透明 + 模糊，隐约透出背后的窗口。',
      'background.blur': '高斯模糊',
      'background.blurDesc': '重度模糊 + 暗底，沉浸式深色提示。',
      'countdown.title': '所有任务已完成',
      'countdown.hibernate': '将进入休眠',
      'countdown.shutdown': '将关机',
      'countdown.suffix': '秒',
      'countdown.cancel': '取消',
      'countdown.hint': '有任何新任务开始，倒计时会自动作废。',
      'countdown.quietDone': '已通过 %s 秒持续空闲',
      'countdown.scheduledAt': '预计 %s 执行（本机时间）',
      'countdown.window': '倒计时窗口 %s 秒',
      'countdown.remaining': '剩余 %s 秒',
      'countdown.progress': '倒计时进度',
      'countdown.scopeTag': '仅覆盖当前 Harness 窗口',
      'countdown.multiNote': '检测到多块屏幕：倒计时只会出现在 Harness 窗口所在的屏幕。若窗口跨了两块屏，可把计时器固定在其中一侧。',
      'countdown.alignLabel': '计时器位置',
      'countdown.alignLeft': '靠左',
      'countdown.alignCenter': '居中',
      'countdown.alignRight': '靠右',
      'countdown.mirrors': '在其它屏幕也显示',
      'countdown.mirrorRetry': '重新显示',
      'countdown.mirrorWorking': '正在打开…',
      'countdown.mirrorsOn': '已在 %s 个附加窗口显示',
      'countdown.mirrorBlocked': '当前 Harness 窗口不允许弹出附加窗口，倒计时只在它所在的屏幕可见。可把 Harness 窗口拖到你正在看的屏幕，或让窗口跨屏后用「计时器位置」把计时器移到一侧。',
      'countdown.mirrorPlain': '已打开一个镜像窗口，请把它拖到另一块屏幕。',
      'countdown.beaconTitle': '关机倒计时 · 镜像窗口',
      'countdown.beaconHint': '在任意窗口取消，都会停止本次电源操作。',
      'countdown.cancelling': '正在取消…',
      'countdown.offline': '连接已断开，预约可能仍在执行。取消尚未确认，请重试。',
      'error.execution-in-progress': '电源操作已经开始执行，无法再取消。',
      'error.reservation-changed': '预约状态刚刚发生了变化，请重新操作。',
      'error.command-unavailable': '找不到可执行的电源命令，请检查 shutdownCommand 配置。',
      'error.agents-unavailable': '智能体注册表不可用，暂时无法预约。',
      'error.unsupported-platform': '此插件只支持 Windows。',
    };
    const en = {
      'rail.label': 'Scheduled power',
      'page.eyebrow': 'IDLE POWER',
      'page.title': 'Scheduled power',
      'page.subtitle': 'Run one power action after every task in this DSH Host has finished.',
      'page.refresh': 'Refresh status',
      'page.retry': 'Retry',
      'page.armShutdown': 'Schedule shutdown',
      'page.armHibernate': 'Schedule hibernation',
      'page.cancel': 'Cancel schedule',
      'foot.plan': 'When scheduled: %s s idle → %s s countdown → %s',
      'page.saving': 'Submitting…',
      'page.loading': 'Loading status…',
      'status.idle': 'Not scheduled',
      'status.waiting': 'Waiting',
      'status.counting': 'Counting down',
      'status.executing': 'Executing power action',
      'status.failed': 'Failed',
      'status.offline': 'Cannot reach the plugin Host',
      'status.unsupported': 'This plugin supports Windows only',
      'status.registryUnavailable': 'Agent registry unavailable; countdown paused',
      'status.tasksSuffix': ' tasks running',
      'status.quietSuffix': 's until the countdown',
      'status.countingSuffix': 's until it runs',
      'status.scheduledAt': 'Scheduled for %s',
      'body.idle': 'Nothing is scheduled. Scheduling waits until every task has finished.',
      'body.waiting': 'The countdown starts once every task has stopped.',
      'body.quiet': 'Every task stopped; this idle window is being confirmed.',
      'body.counting': 'Any new task voids this countdown automatically.',
      'body.executing': 'The power command has been sent and can no longer be cancelled.',
      'body.failed': 'The power action did not succeed; you can schedule it again.',
      'body.offline': 'Status could not be read. The reservation may still run; check the connection before acting.',
      'body.registry': 'The agent registry is missing, so "all tasks finished" cannot be proven; the countdown is paused.',
      'body.unsupported': 'Only Windows provides the hibernate and shutdown commands.',
      'section.mode': 'Power action',
      'section.modeHint': 'What runs when the countdown reaches zero.',
      'section.flow': 'How it runs',
      'section.flowHint': 'Three steps in order; a new task during the countdown voids the whole reservation.',
      'section.background': 'Countdown background',
      'section.backgroundHint': 'Only changes how the countdown window looks.',
      'section.notes': 'Notes',
      'mode.hibernate': 'Hibernate',
      'mode.hibernateDesc': 'Writes a memory snapshot to disk, so the next boot restores every open window and unsaved edit.',
      'mode.shutdown': 'Shut down',
      'mode.shutdownDesc': 'Shuts down Windows after the countdown. DSH conversations remain saved.',
      'flow.idle': '%s s of continuous idle',
      'flow.idleDesc': 'Agents, queued messages and background jobs must all stop, then stay stopped for this long.',
      'flow.countdown': '%s s cancellable countdown',
      'flow.countdownDesc': 'A countdown that fills the whole window; Esc or Cancel stops it.',
      'flow.act': 'Run the power action',
      'flow.actDesc': 'At zero it hibernates or shuts down. Once it starts it cannot be cancelled.',
      'metric.agents': 'Running agents',
      'metric.inbox': 'Queued messages',
      'metric.jobs': 'Background jobs',
      'metric.total': 'Tasks total',
      'hero.progress': 'Time remaining',
      'note.scope': 'Closing this page does not cancel. Only this Host is monitored; other apps and Hosts are not.',
      'note.autoVoid': 'Any new task during the countdown voids this reservation.',
      'note.platform': 'Only Windows provides the hibernate and shutdown commands.',
      'note.hostRestart': 'A Host restart cancels the reservation: a restart means somebody is back at the machine.',
      'note.shutdown': 'Forces apps to close. Unsaved work may be lost; save your work in other apps first.',
      'note.hibernate': 'After hibernating, pressing the power button reads the memory image back.',
      'background.solid': 'Solid',
      'background.solidDesc': 'Opaque surface with the strongest text contrast.',
      'background.glass': 'Frosted glass',
      'background.glassDesc': 'Translucent with a blur; faintly shows the window behind.',
      'background.blur': 'Gaussian blur',
      'background.blurDesc': 'Heavy blur and a dark scrim; an immersive dark warning.',
      'countdown.title': 'All tasks finished',
      'countdown.hibernate': 'About to hibernate',
      'countdown.shutdown': 'About to power off',
      'countdown.suffix': 's',
      'countdown.cancel': 'Cancel',
      'countdown.hint': 'Any new task voids this countdown automatically.',
      'countdown.quietDone': '%s s of continuous idle passed',
      'countdown.scheduledAt': 'Scheduled for %s (local time)',
      'countdown.window': '%s s cancellation window',
      'countdown.remaining': '%s s remaining',
      'countdown.progress': 'Countdown progress',
      'countdown.scopeTag': 'This Harness window only',
      'countdown.multiNote': 'Multiple screens detected: the countdown only appears on the screen holding the Harness window. If the window spans two screens, pin the timer to one side.',
      'countdown.alignLabel': 'Timer position',
      'countdown.alignLeft': 'Left',
      'countdown.alignCenter': 'Center',
      'countdown.alignRight': 'Right',
      'countdown.mirrors': 'Show on other screens',
      'countdown.mirrorRetry': 'Show again',
      'countdown.mirrorWorking': 'Opening…',
      'countdown.mirrorsOn': 'Showing in %s additional window(s)',
      'countdown.mirrorBlocked': 'This Harness window does not allow extra pop-up windows, so the countdown is visible only on its own screen. Move the Harness window to the screen you are watching, or span both screens and use "Timer position" to pin it to one side.',
      'countdown.mirrorPlain': 'Opened one mirror window — drag it to another screen.',
      'countdown.beaconTitle': 'Power-off countdown · mirror',
      'countdown.beaconHint': 'Cancelling in any window stops this power action everywhere.',
      'countdown.cancelling': 'Cancelling…',
      'countdown.offline': 'Connection lost. The reservation may still run. Cancellation is unconfirmed; please retry.',
      'error.execution-in-progress': 'The power command is already executing and can no longer be cancelled.',
      'error.reservation-changed': 'The reservation just changed; please try again.',
      'error.command-unavailable': 'The power command could not be found; check the shutdownCommand setting.',
      'error.agents-unavailable': 'The agent registry is unavailable, so nothing can be scheduled right now.',
      'error.unsupported-platform': 'This plugin supports Windows only.',
    };
    // ---------------------------------------------------------------- styles
    const CSS = `
/* A short press, a soft settle, and a readable reveal share the same cadence.
   Keep these tokens local: a plugin must not change the host's motion system. */
:where(.ipa-page,.ipa-scrim){--ipa-ease:cubic-bezier(.2,.7,.2,1);--ipa-settle:cubic-bezier(.22,1.35,.36,1);--ipa-fast:140ms;--ipa-move:300ms}
/* ---- rail entry --------------------------------------------------------- */
/* The rail renders one glyph per panel and the host owns its tooltip, so the
   reservation state has to live inside the artwork: a dot while a power action
   is pending, blinking once the countdown is running. */
.ipa-railGlyph{display:block}
.ipa-railDot{fill:currentColor}
.ipa-railGlyph[data-phase=counting] .ipa-railDot{fill:var(--dsw-alias-state-error-primary);animation:ipa-blink 1.6s ease-in-out infinite}
@keyframes ipa-blink{0%,100%{opacity:1}50%{opacity:.45}}
/* ---- page shell --------------------------------------------------------- */
/* One semantic layer over the Host palette: components ask for a role
   (surface, muted text, control border, accent) instead of a raw palette
   entry, so the page survives a Host theme change and reads like the rest of
   the app. Borders are mixed from the foreground, not taken from the Host's
   hairline token: on a white surface a 10 %-alpha hairline is invisible, and
   the surface/card distinction has to come from the outline. */
.ipa-page{
--ipa-surface:var(--dsw-alias-bg-base,#fff);
--ipa-card:var(--dsw-alias-bg-layer-1,#fff);
--ipa-sunken:var(--dsw-alias-bg-layer-2,#f4f5f7);
--ipa-fg:var(--dsw-alias-label-primary,#191c22);
--ipa-fg-muted:color-mix(in srgb,var(--ipa-fg) 78%,var(--ipa-surface));
--ipa-fg-subtle:color-mix(in srgb,var(--ipa-fg) 66%,var(--ipa-surface));
--ipa-border:color-mix(in srgb,var(--ipa-fg) 16%,transparent);
--ipa-border-strong:color-mix(in srgb,var(--ipa-fg) 30%,transparent);
--ipa-divider:color-mix(in srgb,var(--ipa-fg) 9%,transparent);
--ipa-accent:var(--dsw-alias-brand-primary,#2f66f5);
--ipa-accent-fg:var(--dsw-alias-label-primary-foreground,#fff);
--ipa-danger:var(--dsw-alias-state-error-primary,#d93a40);
--ipa-hover:var(--dsw-alias-interactive-bg-hover,rgba(18,21,28,.06));
--ipa-ring:var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary,#2f66f5));
--ipa-radius:var(--dsw-radius-md,12px);
--ipa-radius-sm:var(--dsw-radius-sm,8px);
--ipa-radius-xs:var(--dsw-radius-xs,4px);
box-sizing:border-box;container:ipa-page / inline-size;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;overflow:hidden;background:var(--ipa-surface);color:var(--ipa-fg);font-size:.875rem;line-height:1.6;font-variant-numeric:tabular-nums}
.ipa-page *{box-sizing:border-box}
.ipa-pageWrap{width:100%;max-width:1120px;margin:0 auto;padding-inline:clamp(18px,3.6cqw,48px)}
.ipa-pageTop{flex:none;border-bottom:1px solid var(--ipa-divider);background:var(--ipa-surface)}
.ipa-pageHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;flex-wrap:wrap;padding-top:clamp(20px,3cqw,32px);padding-bottom:clamp(14px,2cqw,20px)}
[data-platform=darwin] .ipa-pageHeader{padding-top:calc(32px + var(--dsh-frame-top-clearance,0px))}
.ipa-pageHead{min-width:0;flex:1}
.ipa-pageEyebrow{display:block;margin-bottom:6px;color:var(--ipa-fg-subtle);font-size:.6875rem;font-weight:600;line-height:1.6;letter-spacing:.12em}
.ipa-pageTitle{margin:0;font-size:clamp(1.375rem,3.4cqw,1.75rem);font-weight:650;line-height:1.25;letter-spacing:-.03em;text-wrap:balance}
.ipa-pageSub{margin:6px 0 0;max-width:62ch;color:var(--ipa-fg-muted);font-size:.84375rem;line-height:1.55;text-wrap:pretty}
.ipa-pageTools{display:flex;align-items:center;gap:8px;flex:none}
.ipa-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable}
.ipa-pageBody{display:flex;flex-direction:column;gap:clamp(20px,2.6cqw,28px);padding-top:clamp(18px,2.6cqw,26px);padding-bottom:clamp(24px,3cqw,36px)}
/* ---- action bar --------------------------------------------------------- */
/* The one primary action lives here, next to the choices that decide it, not
   in the header: the reader picks a power action underneath and the button
   that commits it stays in view. */
.ipa-pageFoot{flex:none;border-top:1px solid var(--ipa-border);background:var(--ipa-card);box-shadow:0 -8px 24px -20px rgba(0,0,0,.45)}
.ipa-footInner{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-block:12px}
.ipa-footStatus{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
.ipa-statusDot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--ipa-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--ipa-accent) 18%,transparent)}
.ipa-statusDot[data-tone=error]{background:var(--ipa-danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--ipa-danger) 18%,transparent)}
.ipa-footText{display:flex;flex-direction:column;gap:1px;min-width:0}
.ipa-footPhase{color:var(--ipa-fg);font-size:.8125rem;font-weight:600;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ipa-footMeta{color:var(--ipa-fg-subtle);font-size:.71875rem;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ipa-footActions{display:flex;align-items:center;gap:8px;flex:none}
.ipa-footActions .ipa-button{min-width:140px;min-height:40px;padding-inline:20px;font-size:.84375rem}
/* Native radios carry every choice; the card is only their visible label.
   The input stays focusable and in the accessibility tree, so keyboard users
   get a real radio group (arrow keys move and select) and screen readers get
   "n of m" instead of a row of styled buttons. */
.ipa-choiceInput{position:absolute;inline-size:1px;block-size:1px;margin:0;padding:0;border:0;opacity:0;overflow:hidden;clip-path:inset(50%);pointer-events:none}
/* Screen-reader-only text: never visible, never focusable. */
.ipa-srOnly{position:absolute;inline-size:1px;block-size:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
/* ---- controls ----------------------------------------------------------- */
.ipa-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:none;min-height:36px;padding:7px 14px;border-radius:var(--ipa-radius-sm);border:1px solid var(--ipa-border-strong);background:var(--ipa-card);color:var(--ipa-fg);font:inherit;font-size:.8125rem;font-weight:500;line-height:1.5;cursor:pointer;transition:background-color var(--ipa-fast) var(--ipa-ease),border-color var(--ipa-fast) var(--ipa-ease),transform var(--ipa-fast) var(--ipa-ease)}
@media (hover:hover){.ipa-button:hover:not(:disabled){background:var(--ipa-hover)}}
.ipa-button[data-variant=primary]{border-color:transparent;background:var(--ipa-accent);color:var(--ipa-accent-fg);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.18)}
@media (hover:hover){.ipa-button[data-variant=primary]:hover:not(:disabled){filter:brightness(1.06)}}
.ipa-button[data-variant=danger]{border-color:var(--ipa-danger);background:0 0;color:var(--ipa-danger);font-weight:600}
.ipa-button:disabled{opacity:.45;cursor:default}
.ipa-button:active:not(:disabled){transform:scale(.985)}
.ipa-iconButton{display:inline-flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;padding:0;border-radius:var(--ipa-radius-sm);border:1px solid var(--ipa-border);background:0 0;color:var(--ipa-fg-muted);cursor:pointer}
@media (hover:hover){.ipa-iconButton:hover:not(:disabled){background:var(--ipa-hover);color:var(--ipa-fg)}}
.ipa-iconButton:disabled{opacity:.45;cursor:default}
.ipa-page :focus-visible{outline:2px solid var(--ipa-ring);outline-offset:2px}
/* ---- status hero -------------------------------------------------------- */
.ipa-hero{display:flex;align-items:center;gap:clamp(18px,3cqw,34px);flex-wrap:wrap;padding:clamp(18px,2.6cqw,26px);border:1px solid var(--ipa-border);border-radius:var(--ipa-radius);background:var(--ipa-card)}
.ipa-heroDial{position:relative;display:grid;place-items:center;flex:none;width:clamp(88px,13cqw,112px);height:clamp(88px,13cqw,112px);border-radius:50%;background:var(--ipa-sunken);box-shadow:inset 0 0 0 1px var(--ipa-divider)}
.ipa-heroRing{position:absolute;inset:-1px;width:calc(100% + 2px);height:calc(100% + 2px);transform:rotate(-90deg);overflow:visible}
.ipa-heroRingTrack{fill:none;stroke:var(--ipa-divider);stroke-width:3}
.ipa-heroRingValue{fill:none;stroke:var(--ipa-accent);stroke-width:3;stroke-linecap:round;transition:stroke-dashoffset .26s linear}
.ipa-heroDial[data-urgent] .ipa-heroRingValue{stroke:var(--ipa-danger)}
.ipa-heroValue{display:flex;align-items:baseline;gap:3px;color:var(--ipa-fg)}
.ipa-heroNum{font-size:clamp(1.5rem,4cqw,2rem);font-weight:650;line-height:1;letter-spacing:-.04em}
.ipa-heroUnit{color:var(--ipa-fg-muted);font-size:.75rem}
.ipa-heroGlyph{display:grid;place-items:center;color:var(--ipa-fg-muted)}
.ipa-heroText{display:flex;flex-direction:column;gap:6px;min-width:min(240px,60%);flex:1}
.ipa-heroPhase{font-size:clamp(1rem,2.2cqw,1.1875rem);font-weight:600;line-height:1.35}
.ipa-hero[data-tone=error] .ipa-heroPhase{color:var(--ipa-danger)}
.ipa-heroBody{margin:0;max-width:64ch;color:var(--ipa-fg-muted);font-size:.8125rem;line-height:1.6}
.ipa-heroMeta{display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap;color:var(--ipa-fg-subtle);font-size:.75rem;line-height:1.5}
.ipa-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;border:1px solid var(--ipa-border);background:var(--ipa-sunken);color:var(--ipa-fg-muted);font-size:.71875rem;line-height:1.6;white-space:nowrap}
.ipa-chip[data-tone=accent]{border-color:color-mix(in srgb,var(--ipa-accent) 40%,transparent);background:color-mix(in srgb,var(--ipa-accent) 10%,transparent);color:var(--ipa-accent)}
/* Four equal cells read as one instrument, not four cards. */
.ipa-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:10px 0 0;padding:0;border:1px solid var(--ipa-border);border-radius:var(--ipa-radius);overflow:hidden;background:var(--ipa-card)}
.ipa-metric{display:flex;flex-direction:column;gap:2px;padding:12px 16px;border-inline-end:1px solid var(--ipa-divider)}
.ipa-metric:last-child{border-inline-end:0}
.ipa-metricLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ipa-fg-subtle);font-size:.71875rem;line-height:1.55}
.ipa-metricValue{margin:0;font-size:1.25rem;font-weight:600;line-height:1.3;letter-spacing:-.02em}
/* ---- sections ----------------------------------------------------------- */
.ipa-section{display:flex;flex-direction:column;gap:12px;min-width:0}
.ipa-sectionHead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.ipa-sectionTitle{margin:0;font-size:1rem;font-weight:600;line-height:1.5;letter-spacing:-.01em}
.ipa-sectionBody{margin:0;color:var(--ipa-fg-subtle);font-size:.78125rem;line-height:1.5}
/* ---- mode cards --------------------------------------------------------- */
.ipa-modeGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
/* A ring rather than a thicker border: emphasis without moving the cards. */
.ipa-modeCard{position:relative;display:flex;flex-direction:column;gap:10px;min-width:0;padding:16px;border-radius:var(--ipa-radius);border:1px solid var(--ipa-border);background:var(--ipa-card);color:inherit;font:inherit;font-size:.8125rem;text-align:left;cursor:pointer;transition:border-color var(--ipa-fast) var(--ipa-ease),background-color var(--ipa-fast) var(--ipa-ease),box-shadow var(--ipa-fast) var(--ipa-ease),transform var(--ipa-fast) var(--ipa-ease)}
@media (hover:hover){.ipa-modeCard:hover:not(:has(> :disabled)):not(:has(> :checked)){border-color:var(--ipa-border-strong);background:var(--ipa-hover)}}
.ipa-modeCard:has(> :checked){border-color:var(--ipa-accent);background:color-mix(in srgb,var(--ipa-accent) 6%,var(--ipa-card));box-shadow:0 0 0 1px var(--ipa-accent)}
.ipa-modeCard:has(> :disabled){opacity:.55;cursor:default}
.ipa-modeCard:active:not(:has(> :disabled)){transform:scale(.995)}
.ipa-modeCard:has(> :focus-visible){outline:2px solid var(--ipa-ring);outline-offset:3px}
.ipa-modeCardHead{display:flex;align-items:center;gap:12px}
.ipa-modeIcon{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:var(--ipa-radius-sm);background:var(--ipa-sunken);box-shadow:inset 0 0 0 1px var(--ipa-divider);color:var(--ipa-fg-muted);transition:background-color var(--ipa-fast) var(--ipa-ease),color var(--ipa-fast) var(--ipa-ease),box-shadow var(--ipa-fast) var(--ipa-ease)}
.ipa-modeCard:has(> :checked) .ipa-modeIcon{background:var(--ipa-accent);color:var(--ipa-accent-fg);box-shadow:none}
.ipa-modeCardTitle{flex:1;min-width:0;font-size:.9375rem;font-weight:600;line-height:1.45}
.ipa-modeMark{display:grid;place-items:center;flex:none;width:20px;height:20px;border:1.5px solid var(--ipa-border-strong);border-radius:50%;color:var(--ipa-accent-fg);transition:background-color var(--ipa-fast) var(--ipa-ease),border-color var(--ipa-fast) var(--ipa-ease)}
.ipa-modeCard:has(> :checked) .ipa-modeMark{border-color:var(--ipa-accent);background:var(--ipa-accent)}
.ipa-modeMark path{stroke-dasharray:16;stroke-dashoffset:16;transition:stroke-dashoffset 180ms var(--ipa-ease)}
.ipa-modeCard:has(> :checked) .ipa-modeMark path{stroke-dashoffset:0}
.ipa-modeCardDesc{margin:0;color:var(--ipa-fg-muted);font-size:.78125rem;line-height:1.6}
/* Both notes occupy one grid cell so the section keeps its height when the
   selected mode changes; nothing below it jumps. */
.ipa-modeNotes{display:grid;margin-top:-4px}
.ipa-modeNote{grid-area:1/1;margin:0;visibility:hidden;color:var(--ipa-fg-subtle);font-size:.75rem;line-height:1.55}
.ipa-modeNote[data-active]{visibility:visible}
/* ---- appearance --------------------------------------------------------- */
/* Each preset previews the countdown window it produces, because "frosted
   glass" and "gaussian blur" are not words a reader can compare from labels
   alone. The swatches are miniature overlays over a fixed colourful backdrop:
   they describe the countdown, not the current theme, so their colours are
   local to this preview. */
.ipa-bg{display:flex;flex-direction:column;gap:10px}
.ipa-bgOptions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0;padding:0;border:0}
.ipa-preset{position:relative;display:flex;flex-direction:column;gap:8px;min-width:0;padding:8px;border-radius:var(--ipa-radius);border:1px solid var(--ipa-border);background:var(--ipa-card);color:var(--ipa-fg);font:inherit;font-size:.8125rem;cursor:pointer;transition:border-color var(--ipa-fast) var(--ipa-ease),box-shadow var(--ipa-fast) var(--ipa-ease),background-color var(--ipa-fast) var(--ipa-ease)}
@media (hover:hover){.ipa-preset:hover:not(:has(> :disabled)):not(:has(> :checked)){border-color:var(--ipa-border-strong)}}
.ipa-preset:has(> :checked){border-color:var(--ipa-accent);box-shadow:0 0 0 1px var(--ipa-accent)}
.ipa-preset:has(> :disabled){opacity:.55;cursor:default}
.ipa-preset:has(> :focus-visible){outline:2px solid var(--ipa-ring);outline-offset:3px}
.ipa-presetStage{position:relative;place-items:center;display:grid;height:62px;border-radius:var(--ipa-radius-sm);overflow:hidden;background:#dfe3ea;isolation:isolate}
.ipa-presetBackdrop{position:absolute;inset:0;background:linear-gradient(135deg,#4d7cf3 0 22%,#e8934a 22% 46%,#3fa88f 46% 70%,#8a6bd8 70% 100%)}
.ipa-presetPanel{position:relative;display:grid;place-items:center;width:calc(100% - 16px);height:calc(100% - 16px);border-radius:6px;font-size:.8125rem;font-weight:650;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ipa-preset[data-preset=solid] .ipa-presetPanel{background:#14171d;color:#fff}
.ipa-preset[data-preset=glass] .ipa-presetPanel{background:rgba(22,26,34,.26);color:#fff;-webkit-backdrop-filter:blur(3px) saturate(170%);backdrop-filter:blur(3px) saturate(170%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.26)}
.ipa-preset[data-preset=blur] .ipa-presetPanel{background:rgba(9,11,16,.52);color:#f3f5f9;-webkit-backdrop-filter:blur(9px) saturate(110%);backdrop-filter:blur(9px) saturate(110%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.12)}
.ipa-presetCheck{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:var(--ipa-accent);color:var(--ipa-accent-fg);opacity:0;transform:scale(.8);transition:opacity var(--ipa-fast) var(--ipa-ease),transform var(--ipa-fast) var(--ipa-ease)}
.ipa-preset:has(> :checked) .ipa-presetCheck{opacity:1;transform:none}
.ipa-presetRail{position:absolute;left:8px;right:8px;top:7px;height:3px;border-radius:2px;background:var(--ipa-accent);opacity:.9}
.ipa-presetLabel{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-inline:2px;color:var(--ipa-fg-muted);font-size:.78125rem;line-height:1.4}
.ipa-preset:has(> :checked) .ipa-presetLabel{color:var(--ipa-fg);font-weight:600}
.ipa-bgDesc{margin:0;color:var(--ipa-fg-subtle);font-size:.75rem;line-height:1.55}
/* ---- flow and notes ----------------------------------------------------- */
.ipa-flowList{display:flex;flex-direction:column;margin:0;padding:0;list-style:none;border:1px solid var(--ipa-border);border-radius:var(--ipa-radius);overflow:hidden;background:var(--ipa-card)}
.ipa-flowStep{display:grid;grid-template-columns:auto minmax(0,1fr);gap:2px 14px;padding:14px 16px;border-bottom:1px solid var(--ipa-divider)}
.ipa-flowStep:last-child{border-bottom:0}
.ipa-flowNum{grid-row:span 2;display:grid;place-items:center;width:24px;height:24px;margin-top:2px;border-radius:50%;background:var(--ipa-sunken);box-shadow:inset 0 0 0 1px var(--ipa-border);color:var(--ipa-fg-muted);font-size:.71875rem;font-weight:600}
.ipa-flowTitle{margin:0;font-size:.84375rem;font-weight:600;line-height:1.6}
.ipa-flowBody{margin:0;max-width:72ch;color:var(--ipa-fg-muted);font-size:.78125rem;line-height:1.6}
.ipa-noteList{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.ipa-noteItem{position:relative;max-width:86ch;padding-left:14px;color:var(--ipa-fg-subtle);font-size:.78125rem;line-height:1.6;overflow-wrap:anywhere}
.ipa-noteItem:before{content:'';position:absolute;left:2px;top:.6em;width:4px;height:4px;border-radius:50%;background:currentColor;opacity:.6}
/* ---- banners ------------------------------------------------------------ */
.ipa-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 14px;border-radius:var(--ipa-radius-sm);border:1px solid color-mix(in srgb,var(--ipa-danger) 45%,transparent);background:color-mix(in srgb,var(--ipa-danger) 8%,transparent);color:var(--ipa-danger);font-size:.78125rem;line-height:1.6}
.ipa-bannerText{min-width:0;flex:1}
.ipa-banner .ipa-button{border-color:currentColor;background:0 0;color:inherit;min-height:30px;padding:3px 10px;font-size:.75rem}
/* ---- countdown: the whole window is the warning, not a card in the middle ---- */
/* The scrim is the dialog's positioning and stacking context. The card below is
   opaque and always fills the viewport, so the mask only ever shows in the
   moment before layout settles — which is why it does no blur work. */
.ipa-scrim{position:fixed;inset:0;z-index:60;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;background-color:var(--dsw-alias-bg-mask-3);color:var(--dsw-alias-label-primary);animation:ipa-fade 160ms var(--ipa-ease)}
@media (prefers-reduced-motion:reduce){.ipa-scrim{animation:none}}
@keyframes ipa-fade{from{opacity:0}to{opacity:1}}
/* A rail pinned to the viewport edge keeps draining in peripheral vision even
   when the Harness window is stretched across two monitors, where dead centre
   can land on the bezel between them. */
.ipa-rail{position:fixed;top:0;left:0;right:0;height:clamp(4px,.7vmin,10px);z-index:2;background:var(--dsw-alias-border-l2);pointer-events:none}
.ipa-railFill{display:block;height:100%;width:100%;transform-origin:left center;background:var(--dsw-alias-brand-primary);transition:transform .26s linear,background-color .2s var(--ipa-ease)}
.ipa-isUrgent .ipa-railFill{background:var(--dsw-alias-state-error-primary)}
@media (prefers-reduced-motion:reduce){.ipa-railFill{transition:none}}
/* Three rows spanning the full viewport, no fixed card width: the information
   breathes with whatever monitor (or monitors) the window is on. The surface
   colour is the host's own overlay token, so its label tokens stay readable in
   BOTH themes — dark labels on the dark mask were illegible. */
.ipa-card{position:relative;box-sizing:border-box;width:100%;min-height:100vh;min-height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:clamp(10px,1.8vmin,30px);padding:clamp(24px,4vmin,64px) clamp(20px,4.4vmin,80px) clamp(18px,3vmin,48px);background-color:var(--dsw-alias-bg-overlay);background-image:radial-gradient(ellipse at 50% 38%,rgba(120,135,165,.07),transparent 72%)}
/* ---- background presets -------------------------------------------------
   All three keep the surface/text token PAIR consistent, so contrast never
   depends on what happens to be behind the window. color-mix() is progressive:
   an engine without it simply falls back to the opaque solid declaration.
   The blur preset redefines host tokens on the scrim subtree only; nothing leaks out
   of the overlay and no host token is mutated for the rest of the app. */
.ipa-scrim[data-background=glass]{background-color:rgba(20,24,32,.34);-webkit-backdrop-filter:blur(22px) saturate(130%);backdrop-filter:blur(22px) saturate(130%)}
.ipa-scrim[data-background=glass] .ipa-card{background-color:var(--dsw-alias-bg-overlay);background-color:color-mix(in srgb,var(--dsw-alias-bg-overlay) 66%,transparent)}
.ipa-scrim[data-background=blur]{
background-color:rgba(9,11,16,.42);
-webkit-backdrop-filter:blur(34px) saturate(120%);backdrop-filter:blur(34px) saturate(120%);
--dsw-alias-bg-overlay:#12151c;
--dsw-alias-bg-layer-1:#22262f;
--dsw-alias-bg-layer-2:#22262f;
--dsw-alias-label-primary:#f3f5f9;
--dsw-alias-label-primary-foreground:#12151c;
--dsw-alias-label-secondary:#aab2c0;
--dsw-alias-label-tertiary:#8b94a3;
--dsw-alias-border-l2:rgba(255,255,255,.20);
--dsw-alias-border-l3:rgba(255,255,255,.30);
--dsw-alias-brand-primary:#6f9bff;
--dsw-alias-state-error-primary:#ff6b6b;
--dsw-alias-interactive-bg-hover:rgba(255,255,255,.10);
--dsw-focus-ring-color:#6f9bff;
}
.ipa-scrim[data-background=blur] .ipa-card{background-image:none;background-color:var(--dsw-alias-bg-overlay);background-color:color-mix(in srgb,var(--dsw-alias-bg-overlay) 58%,transparent)}
.ipa-top,.ipa-bottom{display:flex;align-items:flex-start;justify-content:space-between;gap:clamp(12px,2.4vmin,40px);flex-wrap:wrap;min-width:0}
.ipa-bottom{align-items:flex-end}
.ipa-statusLine{display:flex;align-items:flex-start;gap:10px;min-width:0;max-width:min(70ch,72vw)}
.ipa-stateDot{flex:none;width:9px;height:9px;margin-top:.55em;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.ipa-isUrgent .ipa-stateDot{background:var(--dsw-alias-state-error-primary)}
.ipa-eyebrow{font-size:clamp(12px,1.45vmin,17px);letter-spacing:.01em;line-height:1.55;color:var(--dsw-alias-label-primary)}
.ipa-eyebrowSub{display:block;font-size:clamp(11px,1.25vmin,14px);color:var(--dsw-alias-label-secondary);margin-top:2px}
.ipa-topRight{display:flex;flex-direction:column;align-items:flex-end;gap:8px;text-align:right;min-width:0}
.ipa-meta{font-size:clamp(11px,1.35vmin,16px);line-height:1.6;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.ipa-mirrors{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;min-height:36px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:clamp(11px,1.3vmin,14px);cursor:pointer;white-space:nowrap}
@media (hover:hover){.ipa-mirrors:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.ipa-mirrors:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
.ipa-mirrors:disabled{opacity:.55;cursor:default}
/* Wrapping hero: a short/wide window puts the dial beside the copy, a narrow
   one stacks them. Either way Cancel stays above the fold. */
.ipa-stage{display:flex;align-items:center;justify-content:center;gap:clamp(18px,4vmin,80px);flex-wrap:wrap;min-height:0;padding:clamp(8px,1.5vmin,24px) 0}
.ipa-dialWrap{flex:0 0 auto;display:grid;place-items:center;animation:ipa-dial-in 380ms var(--ipa-ease)}
@keyframes ipa-dial-in{from{opacity:.6;transform:scale(.96)}to{opacity:1;transform:none}}
.ipa-dial{position:relative;display:grid;place-items:center;width:clamp(190px,52vmin,640px);height:clamp(190px,52vmin,640px)}
.ipa-ring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.ipa-ringTrack{fill:none;stroke:var(--dsw-alias-border-l2);stroke-width:2.4}
.ipa-ringValue{fill:none;stroke:var(--dsw-alias-brand-primary);stroke-width:2.4;stroke-linecap:round;transition:stroke-dashoffset .26s linear,stroke .2s var(--ipa-ease)}
@media (prefers-reduced-motion:reduce){.ipa-ringValue{transition:none}}
.ipa-dial[data-urgent] .ipa-ringValue{stroke:var(--dsw-alias-state-error-primary)}
.ipa-dialCenter{display:flex;align-items:baseline;gap:clamp(4px,.8vmin,12px);color:var(--dsw-alias-label-primary)}
.ipa-count{font-size:clamp(76px,21vmin,300px);font-weight:600;line-height:.9;letter-spacing:-.045em;font-variant-numeric:tabular-nums}
.ipa-unit{font-size:clamp(16px,2.4vmin,32px);font-weight:400;color:var(--dsw-alias-label-secondary)}
.ipa-dial[data-urgent] .ipa-dialCenter{color:var(--dsw-alias-state-error-primary)}
.ipa-dial[data-urgent] .ipa-unit{color:var(--dsw-alias-state-error-primary)}
.ipa-stageText{display:flex;flex-direction:column;align-items:flex-start;gap:clamp(10px,1.7vmin,24px);min-width:min(300px,82vw);max-width:min(560px,86vw)}
.ipa-mode{font-size:clamp(20px,3.1vmin,46px);font-weight:600;line-height:1.15;color:var(--dsw-alias-label-primary)}
.ipa-metaLine{font-size:clamp(12px,1.5vmin,18px);line-height:1.6;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
/* Cancel is the one escape hatch, so it is the highest-contrast control on the
   screen: inverted against the surface, which works in light and dark themes. */
.ipa-cta{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:clamp(48px,6vmin,72px);padding:0 clamp(28px,4vmin,56px);border-radius:var(--dsw-radius-md);border:.5px solid transparent;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-overlay);font-size:clamp(15px,2vmin,23px);font-weight:600;cursor:pointer;box-shadow:var(--dsw-elevation-soft)}
@media (hover:hover){.ipa-cta:hover{filter:brightness(1.18)}}
.ipa-cta:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:3px}
.ipa-kbd{font-size:clamp(10px,1.1vmin,13px);font-weight:500;line-height:1;padding:4px 7px;border-radius:var(--dsw-radius-xs);border:1px solid rgba(127,140,160,.45);background:rgba(127,140,160,.18);color:inherit}
.ipa-notes{display:flex;flex-direction:column;gap:5px;max-width:min(86ch,72vw)}
.ipa-notes .ipa-hint{font-size:clamp(11px,1.35vmin,15px);color:var(--dsw-alias-label-tertiary);line-height:1.6;margin:0;overflow-wrap:anywhere}
.ipa-notes .ipa-hintWarn{color:var(--dsw-alias-label-secondary)}
.ipa-scopeTag{font-size:clamp(10px,1.15vmin,13px);color:var(--dsw-alias-label-tertiary);text-align:right;white-space:nowrap}
.ipa-feedback{color:var(--dsw-alias-state-error-primary);font-size:clamp(12px,1.5vmin,17px);line-height:1.5;max-width:520px;overflow-wrap:anywhere}
.ipa-mirrorNote{font-size:clamp(10px,1.15vmin,13px);color:var(--dsw-alias-label-tertiary);line-height:1.5;max-width:44ch}
.ipa-cta[aria-disabled=true]{opacity:.6;cursor:wait}
/* A window stretched across two displays can put the exact centre on the bezel.
   Let the reader pin the hero to the half of the window they are looking at. */
.ipa-align{display:inline-flex;align-items:center;gap:4px}
.ipa-alignLabel{font-size:clamp(10px,1.15vmin,13px);color:var(--dsw-alias-label-tertiary);margin-right:4px}
.ipa-alignBtn{min-width:34px;min-height:32px;padding:4px 9px;border-radius:var(--dsw-radius-xs);border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font-size:clamp(11px,1.2vmin,13px);cursor:pointer}
@media (hover:hover){.ipa-alignBtn:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.ipa-alignBtn[aria-pressed=true]{color:var(--dsw-alias-brand-primary);font-weight:600;background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-brand-primary)}
.ipa-alignBtn:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.ipa-card[data-align=left] .ipa-stage{justify-content:flex-start;padding-left:clamp(6px,3vmin,64px)}
.ipa-card[data-align=right] .ipa-stage{justify-content:flex-end;padding-right:clamp(6px,3vmin,64px)}
/* Short or zoomed-in viewports: shrink the dial with vmin so Cancel never falls
   below the fold, and quiet the notes rather than letting them push it away. */
@media (max-height:620px){
.ipa-card{gap:clamp(8px,1.4vmin,16px);padding-top:clamp(20px,3vmin,36px);padding-bottom:clamp(12px,2vmin,24px)}
.ipa-dial{width:clamp(150px,38vmin,320px);height:clamp(150px,38vmin,320px)}
.ipa-count{font-size:clamp(64px,16vmin,150px)}
.ipa-notes .ipa-hint{font-size:11px}
}
@media (max-width:720px){
.ipa-card{padding-left:18px;padding-right:18px}
.ipa-stage{gap:16px}
.ipa-stageText{min-width:0;width:100%;max-width:none;align-items:center;text-align:center}
.ipa-notes{max-width:100%}
.ipa-topRight{align-items:flex-start;text-align:left}
.ipa-scopeTag{display:none}
.ipa-card[data-align=left] .ipa-stage,.ipa-card[data-align=right] .ipa-stage{justify-content:center;padding-left:0;padding-right:0}
}
@media (max-width:480px){.ipa-dial{width:clamp(160px,58vmin,260px);height:clamp(160px,58vmin,260px)}}
/* ---- page responsiveness ------------------------------------------------- */
/* The page is a main-pane view, so it reflows against its own column width
   instead of the viewport: a narrow window must not squeeze four metrics. */
@container ipa-page (max-width:760px){
.ipa-pageHeader{align-items:flex-start}
.ipa-pageTools{width:100%;justify-content:flex-end}
.ipa-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}
.ipa-metric:nth-child(2){border-inline-end:0}
.ipa-metric:nth-child(-n+2){border-bottom:1px solid var(--ipa-divider)}
.ipa-modeGrid{grid-template-columns:minmax(0,1fr)}
.ipa-heroDial{width:88px;height:88px}
.ipa-footActions{width:100%}
.ipa-footActions .ipa-button{width:100%}
}
@container ipa-page (max-width:520px){
.ipa-pageWrap{padding-inline:14px}
.ipa-footMeta{display:none}
.ipa-presetStage{height:54px}
.ipa-presetLabel{font-size:.71875rem}
.ipa-flowStep{padding:12px}
}
/* A coarse pointer (touch, pen) needs a bigger target than a mouse does. */
@media (pointer:coarse){
.ipa-button,.ipa-iconButton{min-height:44px}
.ipa-preset{padding:10px}
.ipa-modeCard{padding:18px}
}
/* Windows High Contrast replaces our palette with system colours, so the
   forced colours are declared explicitly: a real border on every control and a
   visible outline on the selected choice, whose tick is a stroke not a fill. */
@media (forced-colors:active){
.ipa-button,.ipa-iconButton,.ipa-modeCard,.ipa-hero,.ipa-metrics,.ipa-metric,.ipa-flowList,.ipa-flowStep,.ipa-bgOptions,.ipa-banner{border-color:CanvasText}
.ipa-button[data-variant=primary],.ipa-button[data-variant=danger]{forced-color-adjust:none;border:1px solid ButtonText;background:ButtonFace;color:ButtonText}
.ipa-modeCard:has(> :checked),.ipa-preset:has(> :checked){outline:2px solid Highlight;outline-offset:-2px}
.ipa-modeMark{forced-color-adjust:none;border-color:CanvasText}
.ipa-modeCard:has(> :checked) .ipa-modeMark{background:Highlight;border-color:Highlight;color:HighlightText}
.ipa-presetStage{border:1px solid CanvasText}
.ipa-presetCheck{forced-color-adjust:none;background:Highlight;color:HighlightText}
.ipa-heroRingTrack{stroke:CanvasText}
.ipa-heroRingValue{stroke:Highlight}
.ipa-statusDot{background:Highlight}
.ipa-statusDot[data-tone=error]{background:Mark}
}
/* Keep this last so every decorative transition has an immediate readable
   counterpart. Progress still updates from the Host; only interpolation stops. */
@media (prefers-reduced-motion:reduce){
.ipa-page,.ipa-page *,.ipa-page *:before,.ipa-page *:after,.ipa-scrim,.ipa-scrim *,.ipa-card{animation:none!important;transition:none!important}
}
`;
    // ----------------------------------------------------------------- store
    /** Shallow compare, so an unchanged poll result does not re-render the UI. */
    function shallowEqual(left, right) {
      if (left === right) return true;
      if (typeof left !== 'object' || typeof right !== 'object' || left === null || right === null) return false;
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      for (const key of leftKeys) if (left[key] !== right[key]) return false;
      return true;
    }

    /** Smallest observable snapshot store; no external dependency needed. */
    function createStore(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener);
          return () => { listeners.delete(listener); };
        },
        set(next) {
          const previous = value;
          const candidate = typeof next === 'function' ? next(previous) : next;
          if (shallowEqual(previous, candidate)) return;
          value = candidate;
          for (const listener of listeners) listener();
        },
      };
    }

    /** Fetch JSON, returning { ok, value } instead of throwing on transport failure. */
    async function requestJson(route, init) {
      // Abort a hung request so one dead connection cannot wedge the controls.
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timeout = controller === null ? null : setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(route, controller === null ? init : { ...init, signal: controller.signal });
        if (!response.ok) {
          let payload = null;
          try {
            payload = await response.json();
          } catch {
            payload = null;
          }
          return { ok: false, status: response.status, code: payload?.code ?? null, message: payload?.message ?? `HTTP ${response.status}` };
        }
        return { ok: true, value: await response.json() };
      } catch {
        return { ok: false, offline: true, message: null };
      } finally {
        if (timeout !== null) clearTimeout(timeout);
      }
    }

    const EMPTY_STATE = {
      supported: true,
      platform: 'unknown',
      phase: 'idle',
      mode: 'shutdown',
      backgroundStyle: 'solid',
      countdownSeconds: 60,
      quietSeconds: 20,
      remainingSeconds: 0,
      quietRemainingSeconds: 0,
      deadline: null,
      busy: { available: true, agentsRunning: 0, inboxPending: 0, jobsRunning: 0, total: 0 },
      error: null,
      lastExecution: null,
    };

    // --------------------------------------------------------------- runtime
    /**
     * Poll the Host and perform the four mutations. One poller serves every
     * surface — the rail glyph, the page and the countdown overlay — so none of
     * them duplicates transport work.
     * @param ctx - Client root context.
     * @returns store handle and the actions every surface shares.
     */
    function createRuntime(ctx) {
      const store = createStore({ data: EMPTY_STATE, ready: false, offline: false, busy: false, note: null, noteCode: null, notePhase: null });
      const patch = (fields) => store.set((current) => ({ ...current, ...fields }));

      let revision = 0;
      const refresh = async () => {
        if (store.getSnapshot().busy) return;
        const started = revision;
        const result = await requestJson(ROUTE_STATE, { headers: { accept: 'application/json' } });
        // A response started before a mutation must not revive a cancelled reservation.
        if (started !== revision) return;
        if (!result.ok) {
          patch({ offline: true });
          return;
        }
        // The state payload is small and flat enough that comparing it textually
        // is cheaper than re-rendering both overlay entries on every poll.
        const serialized = JSON.stringify(result.value);
        // A rejection belongs to the phase it happened in. Once the Host moves
        // on, the note is stale and must not label the new state as failed.
        if (store.getSnapshot().note !== null && result.value.phase !== store.getSnapshot().notePhase) {
          patch({ note: null, noteCode: null, notePhase: null });
        }
        if (serialized === JSON.stringify(store.getSnapshot().data)) {
          patch({ ready: true, offline: false });
          return;
        }
        patch({ data: result.value, ready: true, offline: false });
      };

      /**
       * One mutation shape for all four POST routes. Bumping the local revision
       * before the request drops any state poll already in flight, so a stale
       * snapshot cannot overwrite the mutation's own response.
       */
      const post = async (route, payload) => {
        if (store.getSnapshot().busy) return false;
        revision += 1;
        patch({ busy: true, note: null });
        const result = await requestJson(route, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: typeof payload === 'string' ? payload : JSON.stringify(payload),
        });
        patch({ busy: false });
        if (result.ok) {
          patch({ data: result.value, ready: true, offline: false, note: null, noteCode: null, notePhase: null });
          return true;
        }
        patch({ offline: result.offline === true, note: result.message ?? null, noteCode: result.code ?? null, notePhase: store.getSnapshot().data.phase });
        return false;
      };

      const arm = (mode) => post(ROUTE_ARM, { mode });
      const cancel = () => post(ROUTE_CANCEL, '{}');
      // The sidebar entry and the panel both read the Host mode, so a selection
      // made here has to live there; keeping it local left the entry stale.
      const setMode = (mode) => post(ROUTE_MODE, { mode });
      // Appearance is Host-owned for the same reason: every window watching this
      // Host must show the same background, including after a page reload.
      const setBackground = (backgroundStyle) => post(ROUTE_BACKGROUND, { backgroundStyle });

      return {
        store,
        refresh,
        arm,
        cancel,
        setMode,
        setBackground,
      };
    }

    const BACKGROUND_STYLES = ['solid', 'glass', 'blur'];

    /** An unknown or stale style from the Host must never blank the overlay. */
    function normalizeBackground(value) {
      return BACKGROUND_STYLES.includes(value) ? value : 'solid';
    }

    /** Fill a `%s` template without depending on the locale engine's interpolation. */
    function fmt(template, value) {
      return typeof template === 'string' ? template.replace('%s', String(value)) : String(value);
    }

    /** Fill a `%s` template with several values, in order. */
    function fill(template, ...values) {
      let index = 0;
      return typeof template === 'string'
        ? template.replace(/%s/g, () => String(values[index++] ?? ''))
        : String(values[0] ?? '');
    }

    /** Wall-clock time of the pending power action, in the reader's own timezone. */
    function formatClock(epochMs) {
      const date = new Date(epochMs);
      const pad = (part) => String(part).padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    // ----------------------------------------------- multi-screen compatibility
    /**
     * A DOM overlay can paint only inside its own window. `screen.isExtended` is
     * the one cheap, permission-free signal that the machine has more than one
     * display. Read everything defensively: the desktop shell denies window.open
     * outright, and the property may be absent or gated by Permissions-Policy.
     */
    function hasMultipleScreens() {
      try {
        const scr = typeof window === 'undefined' ? null : window.screen;
        return Boolean(scr && scr.isExtended);
      } catch {
        return false;
      }
    }

    function screenNumber(...values) {
      for (const value of values) {
        if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
      }
      return 0;
    }

    /**
     * One geometry per screen other than the one the shell is on. A null entry
     * means "no geometry known" — one plain window the reader can drag. Negative
     * left/top are normal for a monitor placed left of or above the primary.
     */
    function mirrorGeometry(details) {
      const screens = Array.isArray(details?.screens) ? details.screens : [];
      const current = details?.currentScreen ?? null;
      const others = screens.filter((screen) => screen !== undefined && screen !== null && screen !== current);
      if (others.length === 0) return [null];
      return others.map((screen) => ({
        left: screenNumber(screen.availLeft, screen.left, 0),
        top: screenNumber(screen.availTop, screen.top, 0),
        width: Math.max(320, screenNumber(screen.availWidth, screen.width, 1024)),
        height: Math.max(240, screenNumber(screen.availHeight, screen.height, 768)),
      }));
    }

    function mirrorFeatures(geometry) {
      const chrome = 'toolbar=no,menubar=no,location=no,status=no,scrollbars=no,resizable=yes';
      if (geometry === null) return `width=880,height=560,${chrome}`;
      return `left=${geometry.left},top=${geometry.top},width=${geometry.width},height=${geometry.height},${chrome}`;
    }

    /** Ask for display geometry only after the reader clicked; it may prompt. */
    async function readScreenDetails() {
      try {
        if (typeof window === 'undefined' || typeof window.getScreenDetails !== 'function') return null;
        return await window.getScreenDetails();
      } catch {
        return null;
      }
    }

    /**
     * Build a mirror countdown inside an about:blank popup using DOM APIs from
     * THIS document. No <script> or <style> is written into the popup, so the
     * shell's CSP cannot strip it; the opener owns every listener and update.
     */
    function createMirrorDocument(win, text) {
      const doc = win.document;
      doc.title = text.title;
      const body = doc.body;
      body.style.cssText = 'margin:0;box-sizing:border-box;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.4vmin;padding:5vmin;background:#10131a;color:#f3f5f9;font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;overflow:hidden';
      const bar = doc.createElement('div');
      bar.style.cssText = 'position:fixed;left:0;top:0;height:8px;width:100%;background:#2a303c';
      const fill = doc.createElement('div');
      // Mirror windows inherit the reader's motion preference from this display.
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
      fill.style.cssText = `height:100%;width:100%;transform-origin:left center;background:#4a8cff;transition:${reduceMotion ? 'none' : 'transform .26s linear'}`;
      bar.appendChild(fill);
      body.appendChild(bar);
      const eyebrow = doc.createElement('div');
      eyebrow.style.cssText = 'font-size:clamp(12px,1.6vmin,18px);letter-spacing:.04em;color:#98a2b3';
      eyebrow.textContent = text.title;
      body.appendChild(eyebrow);
      const dial = doc.createElement('div');
      dial.style.cssText = 'display:flex;align-items:baseline;gap:1.2vmin;line-height:1';
      const count = doc.createElement('span');
      count.style.cssText = 'font-size:clamp(90px,22vmin,320px);font-weight:650;letter-spacing:-.05em;font-variant-numeric:tabular-nums';
      const unit = doc.createElement('span');
      unit.style.cssText = 'font-size:clamp(16px,2.4vmin,34px);color:#98a2b3';
      unit.textContent = text.unit;
      dial.appendChild(count);
      dial.appendChild(unit);
      body.appendChild(dial);
      const action = doc.createElement('div');
      action.style.cssText = 'font-size:clamp(18px,3vmin,44px);font-weight:600';
      body.appendChild(action);
      const meta = doc.createElement('div');
      meta.style.cssText = 'font-size:clamp(12px,1.5vmin,20px);color:#98a2b3;font-variant-numeric:tabular-nums';
      body.appendChild(meta);
      const button = doc.createElement('button');
      button.type = 'button';
      button.style.cssText = 'margin-top:2vmin;min-height:56px;padding:0 36px;border-radius:10px;border:1px solid #3a4252;background:#1e2430;color:#f3f5f9;font:inherit;font-size:clamp(15px,2vmin,24px);font-weight:600;cursor:pointer';
      button.textContent = text.cancel;
      body.appendChild(button);
      const hint = doc.createElement('div');
      hint.style.cssText = 'max-width:52ch;font-size:clamp(11px,1.35vmin,16px);line-height:1.6;color:#7d8797';
      hint.textContent = text.hint;
      body.appendChild(hint);
      return { win, count, fill, action, meta, button };
    }

    /**
     * Best-effort mirrors. The desktop shell's setWindowOpenHandler denies every
     * window.open, so a null return is an expected outcome rather than an error;
     * the caller then shows the honest single-screen explanation.
     */
    async function openMirrorWindows({ text, open }) {
      const details = await readScreenDetails();
      const geometries = mirrorGeometry(details);
      const handles = [];
      let blocked = 0;
      for (let index = 0; index < geometries.length; index += 1) {
        const geometry = geometries[index];
        let win = null;
        try {
          win = open('about:blank', `dsh-idle-power-mirror-${index}`, mirrorFeatures(geometry));
        } catch {
          win = null;
        }
        if (win === null || win === undefined) { blocked += 1; continue; }
        try {
          if (geometry !== null) {
            try {
              win.moveTo?.(geometry.left, geometry.top);
              win.resizeTo?.(geometry.width, geometry.height);
            } catch { /* placement is best-effort */ }
          }
          handles.push(createMirrorDocument(win, text));
        } catch {
          blocked += 1;
          try { win.close(); } catch { /* already gone */ }
        }
      }
      return {
        handles,
        blocked,
        plain: geometries.length === 1 && geometries[0] === null,
        total: geometries.length,
      };
    }

    // -------------------------------------------------------------- controls
    /** Prefer localized copy for a known Host error code; fall back to its message. */
    function describeFailure(code, message, t) {
      if (code !== null && code !== undefined) {
        const key = `error.${code}`;
        const localized = t(key);
        if (localized !== key) return localized;
      }
      return message ?? '';
    }

    /** Power glyph; deliberately geometric and theme-neutral. */
    function PowerGlyph({ size }) {
      const edge = size ?? 16;
      return h('svg', {
        viewBox: '0 0 24 24',
        width: edge,
        height: edge,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      },
        h('path', { d: 'M12 3.2v8.1' }),
        h('path', { d: 'M6.4 6.6a8.1 8.1 0 1 0 11.2 0' }),
      );
    }

    /** Hibernate glyph: a crescent, deliberately plain next to the power glyph. */
    function HibernateGlyph({ size }) {
      const edge = size ?? 16;
      return h('svg', {
        viewBox: '0 0 24 24',
        width: edge,
        height: edge,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      },
        h('path', { d: 'M20.4 14.6A8.4 8.4 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z' }),
      );
    }

    /** Refresh arrow for the page's status control. */
    function RefreshGlyph({ size }) {
      const edge = size ?? 15;
      return h('svg', {
        viewBox: '0 0 24 24',
        width: edge,
        height: edge,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      },
        h('path', { d: 'M20.2 12a8.2 8.2 0 1 1-2.6-6' }),
        h('path', { d: 'M20.4 3.9v4.8h-4.8' }),
      );
    }

    /** Selection tick drawn inside the mode card's radio mark. */
    function CheckGlyph() {
      return h('svg', { viewBox: '0 0 16 16', width: 12, height: 12, fill: 'none', 'aria-hidden': true, focusable: 'false' },
        h('path', { d: 'M3.5 8l3 3 6-6', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      );
    }

    // The rail seat is a plain icon render with no injected props, so the glyph
    // subscribes to the Host snapshot itself. `apply` owns the one assignment.
    let powerStore = null;

    /** Subscribe the rail glyph to the snapshot it has to reflect. */
    function usePowerSnapshot() {
      const [snapshot, setSnapshot] = useState(() => (powerStore === null ? null : powerStore.getSnapshot()));
      useEffect(() => {
        if (powerStore === null) return undefined;
        return powerStore.subscribe(() => setSnapshot(powerStore.getSnapshot()));
      }, []);
      return snapshot;
    }

    /**
     * Left-rail entry, sitting directly under the shipped Plugins and
     * Automation-tasks entries. The rail has room for a glyph and a label only,
     * so the reservation state is drawn into the artwork: a dot while a power
     * action is pending, blinking once the countdown is running.
     */
    function PowerRailIcon(props) {
      // The host may hand the rail entry an injected selector hook, or render it
      // as a plain icon. Both shapes resolve to the same glyph, and the hook
      // order inside each branch stays constant.
      if (typeof props.usePower === 'function') {
        return h(PowerRailGlyph, { ...props, snapshot: props.usePower((current) => current) });
      }
      return h(PowerRailGlyphFromStore, props);
    }

    /** Rail glyph when the host renders the entry without injected props. */
    function PowerRailGlyphFromStore(props) {
      return h(PowerRailGlyph, { ...props, snapshot: usePowerSnapshot() });
    }

    /** The artwork itself: a power glyph plus the pending-reservation dot. */
    function PowerRailGlyph({ size, active, snapshot }) {
      const phase = snapshot === null || snapshot === undefined ? 'idle' : snapshot.data.phase;
      const armed = phase === 'armed' || phase === 'counting';
      const edge = Number.isFinite(size) && size > 0 ? size : 18;
      return h('svg', {
        className: 'ipa-railGlyph',
        viewBox: '0 0 24 24',
        width: edge,
        height: edge,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: active === true ? 1.9 : 1.6,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        focusable: 'false',
        'data-phase': phase,
        style: { display: 'block' },
      },
        h('path', { d: 'M12 3.4v7.4' }),
        h('path', { d: 'M6.9 6.6a7.3 7.3 0 1 0 10.2 0' }),
        armed && h('circle', { className: 'ipa-railDot', cx: 18.6, cy: 5.4, r: 2.4, stroke: 'none' }),
      );
    }

    /**
     * One titled block. The section stays unnamed on purpose: a named <section>
     * becomes a `region` landmark, and four of those around one page dilute the
     * real landmarks. The heading alone gives the outline.
     */
    function Section({ title, hint, children }) {
      return h('section', { className: 'ipa-section' },
        h('div', { className: 'ipa-sectionHead' },
          h('h2', { className: 'ipa-sectionTitle' }, title),
          hint === undefined ? null : h('p', { className: 'ipa-sectionBody' }, hint),
        ),
        children,
      );
    }

    /**
     * The main-pane page. It replaced a sidebar popover: an action that can shut
     * the machine down needs room to say what will happen, in which order, and
     * how to stop it — and a full page is where the shipped Plugins and
     * Automation-tasks panels already live.
     */
    function PowerPage({ usePower, arm, cancel, setMode, setBackground, refresh, t }) {
      const { data, ready, offline, busy, note, noteCode } = usePower((current) => current);
      const counting = data.phase === 'counting';
      const armed = data.phase === 'armed' || counting;
      const locked = data.phase === 'executing';
      const registryDown = data.busy?.available === false;
      const supported = data.supported !== false;
      const [now, setNow] = useState(() => Date.now());

      // Only the countdown needs a ticking clock; an idle page must not re-render.
      useEffect(() => {
        if (!counting) return undefined;
        const timer = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(timer);
      }, [counting]);

      const deadline = data.deadline ?? null;
      const remaining = counting
        ? deadline === null ? data.remainingSeconds : Math.max(0, Math.ceil((deadline - now) / 1000))
        : 0;
      const quietLeft = Math.max(0, data.quietRemainingSeconds ?? 0);
      const quietTotal = data.quietSeconds > 0 ? data.quietSeconds : quietLeft;
      const mode = data.mode === 'shutdown' ? 'shutdown' : 'hibernate';
      const modeName = mode === 'shutdown' ? t('mode.shutdown') : t('mode.hibernate');
      const background = normalizeBackground(data.backgroundStyle);
      const total = data.busy?.total ?? 0;

      // The hero answers one question — what is going to happen, and how soon —
      // so every branch fills the same four slots instead of inventing its own.
      let phaseText;
      let bodyText;
      let tone = 'normal';
      let dialValue = null;
      let dialTotal = 0;
      let urgent = false;
      let scheduledAt = null;

      if (!supported) {
        phaseText = t('status.unsupported');
        bodyText = t('body.unsupported');
        tone = 'error';
      } else if (offline) {
        phaseText = t('status.offline');
        bodyText = t('body.offline');
        tone = 'error';
      } else if (registryDown) {
        phaseText = t('status.registryUnavailable');
        bodyText = t('body.registry');
        tone = 'error';
      } else if (!ready) {
        phaseText = t('page.loading');
        bodyText = '';
      } else if (data.phase === 'failed') {
        phaseText = t('status.failed');
        bodyText = describeFailure(null, data.error, t) || t('body.failed');
        tone = 'error';
      } else if (counting) {
        phaseText = `${t('status.counting')} · ${remaining}${t('status.countingSuffix')}`;
        bodyText = t('body.counting');
        dialValue = remaining;
        dialTotal = data.countdownSeconds > 0 ? data.countdownSeconds : remaining;
        urgent = remaining <= 10;
        scheduledAt = formatClock(deadline === null ? now + remaining * 1000 : deadline);
      } else if (armed) {
        phaseText = total > 0 ? `${t('status.waiting')} · ${total}${t('status.tasksSuffix')}` : t('status.waiting');
        bodyText = total > 0 ? t('body.waiting') : t('body.quiet');
        if (total === 0) {
          dialValue = quietLeft;
          dialTotal = quietTotal;
        }
      } else if (locked) {
        phaseText = t('status.executing');
        bodyText = t('body.executing');
      } else {
        phaseText = t('status.idle');
        bodyText = t('body.idle');
      }

      // One short sentence for assistive tech, derived from the phase alone. It
      // must not carry the per-second number: a polite live region that changes
      // every tick is a speech spammer, and the countdown digits are already a
      // non-live timer.
      let announcement = '';
      if (!supported) announcement = t('status.unsupported');
      else if (offline) announcement = t('status.offline');
      else if (registryDown) announcement = t('status.registryUnavailable');
      else if (!ready) announcement = '';
      else if (data.phase === 'failed') announcement = t('status.failed');
      else if (counting) announcement = t('status.counting');
      else if (armed) announcement = t('status.waiting');
      else if (locked) announcement = t('status.executing');
      else announcement = t('status.idle');

      const canArm = supported && ready && !offline && !busy && !locked && !registryDown;
      const bgDisabled = locked || busy || !ready || offline || !supported;
      const RADIUS = 42;
      const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
      const fraction = dialValue === null || dialTotal <= 0 ? 0 : Math.min(1, Math.max(0, dialValue / dialTotal));

      const metaItems = [fmt(t('countdown.window'), String(data.countdownSeconds))];
      if (scheduledAt !== null) metaItems.unshift(fmt(t('status.scheduledAt'), scheduledAt));

      // The action bar repeats the plan in one line, so the reader can confirm
      // what the button will do without scrolling back through the flow.
      const footMeta = counting
        ? (scheduledAt === null ? t('body.counting') : fmt(t('status.scheduledAt'), scheduledAt))
        : armed
          ? bodyText
          : (!supported || offline || registryDown || locked || !ready || data.phase === 'failed')
            ? bodyText
            : fill(t('foot.plan'), String(data.quietSeconds), String(data.countdownSeconds), modeName);

      const metric = (labelKey, value) => h('div', { className: 'ipa-metric', key: labelKey },
        h('dt', { className: 'ipa-metricLabel' }, t(labelKey)),
        h('dd', { className: 'ipa-metricValue' }, String(value)),
      );

      const modeDisabled = !supported || !ready || offline || busy || locked || registryDown;
      // A choice card is a label wrapping the native radio, so the browser owns
      // the selection, the arrow keys and the "2 of 2" announcement. The card
      // only draws it: the description is exposed as the control's description
      // instead of being folded into its name.
      const modeCard = (value, titleKey, descKey, Icon) => {
        const descId = `ipa-mode-${value}`;
        return h('label', {
          key: value,
          className: 'ipa-modeCard',
          'data-active': mode === value || undefined,
        },
          h('input', {
            type: 'radio',
            className: 'ipa-choiceInput',
            name: 'ipa-mode',
            value,
            checked: mode === value,
            disabled: modeDisabled,
            'aria-label': t(titleKey),
            'aria-describedby': descId,
            onChange: () => {
              if (value === mode) return;
              // While reserved, changing the mode re-arms with it; while idle it
              // just records what 预约 would do.
              if (armed) void arm(value);
              else void setMode(value);
            },
          }),
          h('span', { className: 'ipa-modeCardHead' },
            h('span', { className: 'ipa-modeIcon', 'aria-hidden': true }, h(Icon, { size: 18 })),
            h('span', { className: 'ipa-modeCardTitle' }, t(titleKey)),
            h('span', { className: 'ipa-modeMark', 'aria-hidden': true }, h(CheckGlyph)),
          ),
          h('span', { className: 'ipa-modeCardDesc', id: descId }, t(descKey)),
        );
      };

      const styleChoices = [
        ['solid', 'background.solid', 'background.solidDesc'],
        ['glass', 'background.glass', 'background.glassDesc'],
        ['blur', 'background.blur', 'background.blurDesc'],
      ];

      const flowSteps = [
        ['flow.idle', 'flow.idleDesc', fmt(t('flow.idle'), String(data.quietSeconds))],
        ['flow.countdown', 'flow.countdownDesc', fmt(t('flow.countdown'), String(data.countdownSeconds))],
        ['flow.act', 'flow.actDesc', modeName],
      ];

      return h('div', { className: 'ipa-page' },
        h('header', { className: 'ipa-pageTop' },
          h('div', { className: 'ipa-pageWrap' },
            h('div', { className: 'ipa-pageHeader' },
              h('div', { className: 'ipa-pageHead' },
                h('span', { className: 'ipa-pageEyebrow' }, t('page.eyebrow')),
                h('h1', { className: 'ipa-pageTitle' }, t('page.title')),
                h('p', { className: 'ipa-pageSub' }, t('page.subtitle')),
              ),
              h('div', { className: 'ipa-pageTools' },
                h('button', {
                  type: 'button',
                  className: 'ipa-iconButton',
                  'aria-label': t('page.refresh'),
                  title: t('page.refresh'),
                  disabled: busy,
                  onClick: () => { void refresh(); },
                }, h(RefreshGlyph, { size: 15 })),
              ),
            ),
          ),
        ),
        h('div', { className: 'ipa-scroll' },
          h('div', { className: 'ipa-pageWrap ipa-pageBody' },
            // The only live region on the page: phase changes are announced,
            // counters and seconds are not.
            h('p', { className: 'ipa-srOnly', role: 'status' }, announcement),
            note !== null && note !== undefined && h('div', { className: 'ipa-banner', role: 'alert' },
              h('span', { className: 'ipa-bannerText' }, describeFailure(noteCode, note, t)),
            ),
            h('div', { className: 'ipa-hero', 'data-tone': tone === 'error' ? 'error' : undefined },
              h('div', {
                className: 'ipa-heroDial',
                'data-urgent': urgent || undefined,
                // The ring is real progress, so it exposes a value instead of
                // being decoration the reader has to infer from the digits.
                role: dialValue === null ? undefined : 'progressbar',
                'aria-label': dialValue === null ? undefined : t('hero.progress'),
                'aria-valuemin': dialValue === null ? undefined : 0,
                'aria-valuemax': dialValue === null ? undefined : Math.max(1, dialTotal),
                'aria-valuenow': dialValue === null ? undefined : dialValue,
                'aria-valuetext': dialValue === null ? undefined : fmt(t('countdown.remaining'), String(dialValue)),
              },
                dialValue === null
                  ? h('span', { className: 'ipa-heroGlyph' }, h(PowerGlyph, { size: 34 }))
                  : h('svg', { className: 'ipa-heroRing', viewBox: '0 0 100 100', 'aria-hidden': true },
                    h('circle', { className: 'ipa-heroRingTrack', cx: 50, cy: 50, r: RADIUS }),
                    h('circle', {
                      className: 'ipa-heroRingValue',
                      cx: 50,
                      cy: 50,
                      r: RADIUS,
                      'stroke-dasharray': CIRCUMFERENCE,
                      'stroke-dashoffset': CIRCUMFERENCE * (1 - fraction),
                    }),
                  ),
                dialValue === null ? null : h('div', { className: 'ipa-heroValue', role: 'timer', 'aria-live': 'off' },
                  h('span', { className: 'ipa-heroNum' }, String(dialValue)),
                  h('span', { className: 'ipa-heroUnit' }, t('countdown.suffix')),
                ),
              ),
              h('div', { className: 'ipa-heroText' },
                h('span', { className: 'ipa-heroPhase' }, phaseText),
                bodyText === '' ? null : h('p', { className: 'ipa-heroBody' }, bodyText),
                h('div', { className: 'ipa-heroMeta' },
                  h('span', { className: 'ipa-chip', 'data-tone': armed ? 'accent' : undefined },
                    h(mode === 'shutdown' ? PowerGlyph : HibernateGlyph, { size: 12 }),
                    modeName,
                  ),
                  ...metaItems.map((text) => h('span', { key: text }, text)),
                ),
              ),
            ),
            h('dl', { className: 'ipa-metrics' },
              metric('metric.agents', data.busy?.agentsRunning ?? 0),
              metric('metric.inbox', data.busy?.inboxPending ?? 0),
              metric('metric.jobs', data.busy?.jobsRunning ?? 0),
              metric('metric.total', total),
            ),
            h(Section, { title: t('section.mode'), hint: t('section.modeHint') },
              h('div', { className: 'ipa-modeGrid', role: 'radiogroup', 'aria-label': t('section.mode') },
                modeCard('hibernate', 'mode.hibernate', 'mode.hibernateDesc', HibernateGlyph),
                modeCard('shutdown', 'mode.shutdown', 'mode.shutdownDesc', PowerGlyph),
              ),
              // Both notes share one grid cell, so switching mode never moves
              // the sections below it.
              h('div', { className: 'ipa-modeNotes' },
                ...['hibernate', 'shutdown'].map((value) => h('p', {
                  key: value,
                  className: 'ipa-modeNote',
                  'data-active': mode === value || undefined,
                  'aria-hidden': mode !== value,
                }, t(value === 'shutdown' ? 'note.shutdown' : 'note.hibernate'))),
              ),
            ),
            h(Section, { title: t('section.background'), hint: t('section.backgroundHint') },
              h('div', { className: 'ipa-bg' },
                h('div', {
                  className: 'ipa-bgOptions',
                  role: 'radiogroup',
                  'aria-label': t('section.background'),
                },
                  ...styleChoices.map(([value, labelKey]) => h('label', {
                    key: value,
                    className: 'ipa-preset',
                    'data-preset': value,
                    'data-active': background === value || undefined,
                  },
                    h('input', {
                      type: 'radio',
                      className: 'ipa-choiceInput',
                      name: 'ipa-background',
                      value,
                      checked: background === value,
                      disabled: bgDisabled,
                      onChange: () => { if (value !== background) void setBackground(value); },
                    }),
                    // A miniature countdown window over the same backdrop in all
                    // three tiles, so the difference between opaque, frosted and
                    // blurred is visible instead of described.
                    h('span', { className: 'ipa-presetStage', 'aria-hidden': true },
                      h('span', { className: 'ipa-presetBackdrop' }),
                      h('span', { className: 'ipa-presetPanel' },
                        h('span', { className: 'ipa-presetRail' }),
                        String(data.countdownSeconds),
                      ),
                      h('span', { className: 'ipa-presetCheck' }, h(CheckGlyph)),
                    ),
                    h('span', { className: 'ipa-presetLabel' }, t(labelKey)),
                  )),
                ),
                h('p', { className: 'ipa-bgDesc' }, t(`background.${background}Desc`)),
              ),
            ),
            h(Section, { title: t('section.flow'), hint: t('section.flowHint') },
              h('ol', { className: 'ipa-flowList' },
                ...flowSteps.map(([titleKey, descKey, title], index) => h('li', { className: 'ipa-flowStep', key: titleKey },
                  h('span', { className: 'ipa-flowNum', 'aria-hidden': true }, String(index + 1)),
                  h('h3', { className: 'ipa-flowTitle' }, title),
                  h('p', { className: 'ipa-flowBody' }, t(descKey)),
                )),
              ),
            ),
            h(Section, { title: t('section.notes') },
              h('ul', { className: 'ipa-noteList' },
                ...['note.scope', 'note.autoVoid', 'note.hostRestart', 'note.platform'].map((key) => h('li', { className: 'ipa-noteItem', key }, t(key))),
              ),
            ),
          ),
        ),
        h('footer', { className: 'ipa-pageFoot' },
          h('div', { className: 'ipa-pageWrap ipa-footInner' },
            h('div', { className: 'ipa-footStatus' },
              h('span', { className: 'ipa-statusDot', 'data-tone': tone === 'error' ? 'error' : undefined, 'aria-hidden': true }),
              h('div', { className: 'ipa-footText' },
                h('span', { className: 'ipa-footPhase' }, phaseText),
                h('span', { className: 'ipa-footMeta' }, footMeta),
              ),
            ),
            h('div', { className: 'ipa-footActions' },
              armed
                ? h('button', {
                  type: 'button',
                  className: 'ipa-button',
                  'data-variant': 'danger',
                  disabled: busy,
                  onClick: () => { void cancel(); },
                }, t(busy ? 'countdown.cancelling' : 'page.cancel'))
                : h('button', {
                  type: 'button',
                  className: 'ipa-button',
                  'data-variant': 'primary',
                  disabled: !canArm,
                  onClick: () => { void arm(mode); },
                }, h(mode === 'shutdown' ? PowerGlyph : HibernateGlyph, { size: 15 }),
                t(busy ? 'page.saving' : (mode === 'shutdown' ? t('page.armShutdown') : t('page.armHibernate')))),
            ),
          ),
        ),
      );
    }
    /**
     * Full-window countdown; the only cancel affordance before an irreversible
     * action. The entire viewport is the warning: a rail drains at the top edge,
     * the hero scales with vmin, and context sits at the corners instead of being
     * squeezed into a small centred card. That matters most on a large or 4K
     * monitor, and on a window spanning two displays where dead centre can land
     * on the bezel.
     */
    function PowerCountdown({ usePower, cancel, t }) {
      const { data, busy, offline, note, noteCode } = usePower((current) => current);
      const cancelRef = useRef(null);
      const mirrorRef = useRef(null);
      const mirrorsRef = useRef([]);
      const [now, setNow] = useState(() => Date.now());
      const [align, setAlign] = useState('center');
      const [mirrorStatus, setMirrorStatus] = useState({ kind: 'idle', count: 0 });
      const extended = useMemo(() => hasMultipleScreens(), []);

      useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(timer);
      }, []);

      // The taskbar is often visible on every monitor even when the app window is
      // not. Mirroring the seconds into the title is the one zero-permission cue
      // that survives a window being on another screen, and it is restored when
      // the countdown ends. Any mirrors we opened are closed at the same time.
      useEffect(() => {
        const previousTitle = typeof document === 'undefined' ? null : document.title;
        return () => {
          if (previousTitle !== null) {
            try { document.title = previousTitle; } catch { /* host owns the title */ }
          }
          for (const handle of mirrorsRef.current) {
            try { handle.win.close(); } catch { /* already closed */ }
          }
          mirrorsRef.current = [];
        };
      }, []);

      const cancelCountdown = useCallback(() => { if (!busy) void cancel(); }, [cancel, busy]);

      useEffect(() => {
        const previous = document.activeElement;
        cancelRef.current?.focus?.();
        return () => { if (previous?.isConnected) previous.focus?.(); };
      }, []);

      // Escape cancels from anywhere. Tab cycles inside the dialog so the mirror
      // button stays keyboard-reachable instead of stealing focus from Cancel.
      useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') { event.preventDefault?.(); cancelCountdown(); return; }
          if (event.key !== 'Tab') return;
          const controls = [cancelRef.current, mirrorRef.current].filter(
            (el) => el !== null && el !== undefined && typeof el.focus === 'function' && el.isConnected !== false,
          );
          if (controls.length === 0) { event.preventDefault?.(); cancelRef.current?.focus?.(); return; }
          const active = typeof document === 'undefined' ? null : document.activeElement;
          const index = controls.indexOf(active);
          if (index === -1) { event.preventDefault?.(); controls[0].focus(); return; }
          const step = event.shiftKey ? -1 : 1;
          event.preventDefault?.();
          controls[(index + step + controls.length) % controls.length].focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [cancelCountdown]);

      const showMirrors = useCallback(async () => {
        setMirrorStatus({ kind: 'working', count: 0 });
        for (const handle of mirrorsRef.current) {
          try { handle.win.close(); } catch { /* already closed */ }
        }
        mirrorsRef.current = [];
        const text = {
          title: t('countdown.beaconTitle'),
          unit: t('countdown.suffix'),
          cancel: t(busy ? 'countdown.cancelling' : 'countdown.cancel'),
          hint: t('countdown.beaconHint'),
        };
        const result = await openMirrorWindows({
          text,
          open: (url, name, features) => {
            try {
              if (typeof window === 'undefined' || typeof window.open !== 'function') return null;
              return window.open(url, name, features);
            } catch { return null; }
          },
        });
        for (const handle of result.handles) {
          try {
            handle.button.addEventListener('click', cancelCountdown);
            handle.win.addEventListener('keydown', (event) => { if (event.key === 'Escape') cancelCountdown(); });
          } catch { /* listeners are best-effort */ }
        }
        mirrorsRef.current = result.handles;
        if (result.handles.length === 0) setMirrorStatus({ kind: 'blocked', count: 0 });
        else if (result.plain) setMirrorStatus({ kind: 'plain', count: result.handles.length });
        else setMirrorStatus({ kind: 'on', count: result.handles.length });
      }, [t, busy, cancelCountdown]);

      const deadline = data.deadline;
      const remaining = deadline === null ? data.remainingSeconds : Math.max(0, Math.ceil((deadline - now) / 1000));
      // The ring and rail use the un-rounded remainder so they move on every
      // 250ms tick; the digits keep the rounded value a person can read.
      const exactRemaining = deadline === null ? remaining : Math.max(0, (deadline - now) / 1000);
      const urgent = remaining <= 10;
      const total = data.countdownSeconds > 0 ? data.countdownSeconds : remaining;
      const RADIUS = 54;
      const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
      const fraction = total > 0 ? Math.min(1, Math.max(0, exactRemaining / total)) : 0;
      const action = data.mode === 'hibernate' ? t('countdown.hibernate') : t('countdown.shutdown');
      const scheduledAt = formatClock(deadline === null ? now + remaining * 1000 : deadline);
      const quietSeconds = data.quietSeconds > 0 ? data.quietSeconds : 20;
      const windowSeconds = total > 0 ? total : remaining;
      const valueNow = Math.max(0, Math.min(remaining, Math.max(1, windowSeconds)));
      const railScale = `scaleX(${fraction})`;

      // Seconds only, so the title changes once a second rather than four times.
      useEffect(() => {
        try { document.title = `${remaining}${t('countdown.suffix')} · ${action}`; } catch { /* host owns the title */ }
      }, [remaining, action, t]);

      // Mirrors have no script of their own; this window drives every update.
      useEffect(() => {
        for (const handle of mirrorsRef.current) {
          try {
            handle.count.textContent = String(remaining);
            handle.fill.style.transform = railScale;
            handle.fill.style.backgroundColor = urgent ? '#ff6b6b' : '#4a8cff';
            handle.count.style.color = urgent ? '#ff6b6b' : '#f3f5f9';
            handle.action.textContent = action;
            handle.meta.textContent = fmt(t('countdown.scheduledAt'), scheduledAt);
          } catch { /* a closed mirror is harmless */ }
        }
      }, [remaining, action, scheduledAt, railScale, urgent, t]);

      const alignChoices = [
        ['left', 'countdown.alignLeft'],
        ['center', 'countdown.alignCenter'],
        ['right', 'countdown.alignRight'],
      ];

      return h('div', {
        className: `ipa-scrim${urgent ? ' ipa-isUrgent' : ''}`,
        'data-background': normalizeBackground(data.backgroundStyle),
        role: 'alertdialog',
        'aria-modal': true,
        'aria-label': t('countdown.title'),
      },
        h('div', {
          className: 'ipa-rail',
          role: 'progressbar',
          'aria-label': t('countdown.progress'),
          'aria-valuemin': 0,
          'aria-valuemax': Math.max(1, windowSeconds),
          'aria-valuenow': valueNow,
          'aria-valuetext': fmt(t('countdown.remaining'), String(remaining)),
        },
          h('span', { className: 'ipa-railFill', style: { transform: railScale } }),
        ),
        h('div', { className: 'ipa-card', 'data-align': align === 'center' ? undefined : align },
          h('div', { className: 'ipa-top' },
            h('div', { className: 'ipa-statusLine' },
              h('span', { className: 'ipa-stateDot', 'aria-hidden': true }),
              h('div', { className: 'ipa-eyebrow' },
                t('countdown.title'),
                h('span', { className: 'ipa-eyebrowSub' }, fmt(t('countdown.quietDone'), String(quietSeconds))),
              ),
            ),
            h('div', { className: 'ipa-topRight' },
              h('div', { className: 'ipa-meta' },
                fmt(t('countdown.window'), String(windowSeconds)),
              ),
              extended && h('div', { className: 'ipa-align', role: 'group', 'aria-label': t('countdown.alignLabel') },
                h('span', { className: 'ipa-alignLabel' }, t('countdown.alignLabel')),
                ...alignChoices.map(([value, key]) => h('button', {
                  type: 'button',
                  key: value,
                  className: 'ipa-alignBtn',
                  'aria-pressed': align === value,
                  'aria-label': t(key),
                  title: t(key),
                  onClick: () => setAlign(value),
                }, t(key))),
              ),
              extended && h('button', {
                type: 'button',
                className: 'ipa-mirrors',
                ref: mirrorRef,
                disabled: mirrorStatus.kind === 'working',
                onClick: () => { void showMirrors(); },
              },
                mirrorStatus.kind === 'working'
                  ? t('countdown.mirrorWorking')
                  : (mirrorStatus.kind === 'on' || mirrorStatus.kind === 'plain')
                    ? t('countdown.mirrorRetry')
                    : t('countdown.mirrors'),
              ),
              mirrorStatus.kind === 'on' && h('span', { className: 'ipa-mirrorNote', role: 'status' }, fmt(t('countdown.mirrorsOn'), String(mirrorStatus.count))),
              mirrorStatus.kind === 'plain' && h('span', { className: 'ipa-mirrorNote', role: 'status' }, t('countdown.mirrorPlain')),
              mirrorStatus.kind === 'blocked' && h('span', { className: 'ipa-feedback', role: 'alert' }, t('countdown.mirrorBlocked')),
            ),
          ),
          h('div', { className: 'ipa-stage' },
            h('div', { className: 'ipa-dialWrap' },
              h('div', { className: 'ipa-dial', 'data-urgent': urgent || undefined },
                h('svg', { className: 'ipa-ring', viewBox: '0 0 120 120', 'aria-hidden': true },
                  h('circle', { className: 'ipa-ringTrack', cx: 60, cy: 60, r: RADIUS }),
                  h('circle', {
                    className: 'ipa-ringValue',
                    cx: 60,
                    cy: 60,
                    r: RADIUS,
                    'stroke-dasharray': CIRCUMFERENCE,
                    'stroke-dashoffset': CIRCUMFERENCE * (1 - fraction),
                  }),
                ),
                h('div', { className: 'ipa-dialCenter', role: 'timer', 'aria-live': 'off' },
                  // Update text in place so each second keeps the same baseline.
                  h('span', { className: 'ipa-count' }, String(remaining)),
                  h('span', { className: 'ipa-unit' }, t('countdown.suffix')),
                ),
              ),
            ),
            h('div', { className: 'ipa-stageText' },
              h('div', { className: 'ipa-mode' }, action),
              h('div', { className: 'ipa-metaLine' }, fmt(t('countdown.scheduledAt'), scheduledAt)),
              (offline || note) && h('div', { className: 'ipa-feedback', role: 'alert' }, offline ? t('countdown.offline') : `${t('status.failed')}: ${describeFailure(noteCode, note, t)}`),
              h('button', {
                type: 'button',
                className: 'ipa-cta',
                ref: cancelRef,
                'aria-disabled': Boolean(busy),
                onClick: cancelCountdown,
                autoFocus: true,
              },
                t(busy ? 'countdown.cancelling' : 'countdown.cancel'),
                h('kbd', { className: 'ipa-kbd' }, 'Esc'),
              ),
            ),
          ),
          h('div', { className: 'ipa-bottom' },
            h('div', { className: 'ipa-notes' },
              h('p', { className: 'ipa-hint' }, t('countdown.hint')),
              h('p', { className: 'ipa-hint' }, t('note.scope')),
              extended && h('p', { className: 'ipa-hint' }, t('countdown.multiNote')),
              data.mode === 'shutdown' && h('p', { className: 'ipa-hint ipa-hintWarn' }, t('note.shutdown')),
            ),
            h('div', { className: 'ipa-scopeTag' }, t('countdown.scopeTag')),
          ),
        ),
      );
    }

    // ----------------------------------------------------------------- mount
    // Pure helpers are surfaced for the dependency-free test harness; the loader
    // only reads `inject` and `apply`, so this adds no runtime behaviour.
    return {
      inject: ['slots', 'locale'],
      internals: { fmt, formatClock, normalizeBackground, BACKGROUND_STYLES, hasMultipleScreens, mirrorGeometry, mirrorFeatures, readScreenDetails, openMirrorWindows, createMirrorDocument },
      apply(ctx) {
        const runtime = createRuntime(ctx);
        // The rail glyph is rendered outside any injected seat, so it reads the
        // store from here instead of from a prop.
        powerStore = runtime.store;
        const t = typeof ctx.locale.bind === 'function' ? ctx.locale.bind(NS) : (key) => key;

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-idle-power';
          tag.dataset.pluginCss = 'dsh-idle-power/dsh-idle-power.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => { tag.remove(); };
        }, 'dsh-idle-power: stylesheet');

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-idle-power: dictionaries');

        // One poller for every surface: 1s while a reservation is live, 3s idle.
        ctx.effect(() => {
          let disposed = false;
          let timer;
          const tick = async () => {
            if (disposed) return;
            await runtime.refresh();
            if (disposed) return;
            const phase = runtime.store.getSnapshot().data.phase;
            const active = phase === 'armed' || phase === 'counting' || phase === 'executing';
            timer = setTimeout(tick, active ? 1000 : 3000);
          };
          tick();
          return () => {
            disposed = true;
            clearTimeout(timer);
          };
        }, 'dsh-idle-power: poller');

        // Rail entry: directly under the shipped 插件 and 自动化任务 panels, so a
        // scheduled power action reads as one more automation in the same list.
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'idle-power',
          order: 15,
          locale: NS,
          label: () => t('rail.label'),
          // Optional: a host that passes slot props through gives the glyph the
          // live store; one that renders a bare icon leaves the module store.
          inject: () => ({ hooks: { power: runtime.store } }),
        }, PowerRailIcon));

        // The page owns the whole main column while this entry is selected.
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'idle-power',
          locale: NS,
          inject: () => ({
            hooks: { power: runtime.store },
            arm: runtime.arm,
            cancel: runtime.cancel,
            setMode: runtime.setMode,
            setBackground: runtime.setBackground,
            refresh: runtime.refresh,
          }),
        }, PowerPage));

        // The countdown stays a shell overlay: it must cover every page.
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-idle-power.countdown',
          order: 100,
          locale: NS,
          inject: () => ({
            hooks: { power: runtime.store },
            cancel: runtime.cancel,
          }),
        }, function CountdownWhenCounting({ usePower, ...rest }) {
          const { data } = usePower((current) => current);
          return data.phase === 'counting' ? h(PowerCountdown, { usePower, ...rest }) : null;
        }));
      },
    };
  },
});
