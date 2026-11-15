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
      'button.tip': '空闲后休眠或关机',
      'entry.schedulePrefix': '预约',
      'entry.secondsTo': ' 秒后',
      'entry.quietSuffix': ' 秒后开始倒计时',
      'mode.hibernate.short': '休眠',
      'mode.shutdown.short': '关机',
      'panel.title': '空闲后休眠或关机',
      'panel.subtitle': '等待当前 DSH Host 的任务结束，再执行一次电源操作。',
      'panel.flow': '执行流程',
      'panel.quiet': '秒持续空闲',
      'panel.countdown': '秒可取消倒计时',
      'panel.scope': '关闭页面不会取消预约；不监测其他应用或其他 Host。',
      'panel.mode': '电源操作',
      'status.loading': '正在读取状态…',
      'status.saving': '正在提交…',
      'status.executing': '正在执行电源操作',
      'status.agents': '运行中的智能体',
      'status.inbox': '排队消息',
      'status.jobs': '后台任务',
      'countdown.cancelling': '正在取消…',
      'countdown.offline': '连接已断开，预约可能仍在执行。取消尚未确认，请重试。',
      'error.execution-in-progress': '电源操作已经开始执行，无法再取消。',
      'error.reservation-changed': '预约状态刚刚发生了变化，请重新操作。',
      'error.command-unavailable': '找不到可执行的电源命令，请检查 shutdownCommand 配置。',
      'error.agents-unavailable': '智能体注册表不可用，暂时无法预约。',
      'error.unsupported-platform': '此插件只支持 Windows。',
      'panel.hibernate': '休眠',
      'panel.hibernateDesc': '内存快照落盘，等于断电；下次开机原样恢复窗口和未保存的内容。',
      'panel.shutdown': '关机',
      'panel.shutdownDesc': '倒计时结束后关闭 Windows，DSH 对话记录仍然保留。',
      'panel.shutdownNote': '会强制关闭应用，未保存的内容可能丢失。请先保存其他应用的工作。',
      'panel.hibernateNote': '休眠后按电源键会把整机内存读回来，开着的窗口都还在。',
      'panel.arm': '预约',
      'panel.cancel': '取消预约',
      'panel.close': '关闭',
      'status.idle': '未预约',
      'status.waiting': '等待中',
      'status.tasksSuffix': ' 个任务在跑',
      'status.quietPrefix': '任务已停下，',
      'status.quietSuffix': ' 秒后开始倒计时',
      'status.counting': '倒计时中',
      'status.failed': '执行失败',
      'status.offline': '连不上插件 Host',
      'status.unsupported': '此插件只支持 Windows',
      'status.registryUnavailable': '智能体注册表不可用，已暂停倒计时',
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
      'panel.background': '倒计时背景',
      'background.solid': '纯色',
      'background.solidDesc': '不透明底色，文字对比度最高。',
      'background.glass': '毛玻璃',
      'background.glassDesc': '半透明 + 模糊，隐约透出背后的窗口。',
      'background.blur': '高斯模糊',
      'background.blurDesc': '重度模糊 + 暗底，沉浸式深色提示。',
    };
    const en = {
      'button.tip': 'Hibernate or power off when idle',
      'entry.schedulePrefix': 'Schedule ',
      'entry.secondsTo': 's to ',
      'entry.quietSuffix': 's to countdown',
      'mode.hibernate.short': 'hibernate',
      'mode.shutdown.short': 'shut down',
      'panel.title': 'Hibernate or power off when idle',
      'panel.subtitle': 'Run one power action after tasks in this DSH Host finish.',
      'panel.flow': 'How it runs',
      'panel.quiet': 's continuously idle',
      'panel.countdown': 's cancellable countdown',
      'panel.scope': 'Closing this page does not cancel. Other apps and Hosts are not monitored.',
      'panel.mode': 'Power action',
      'status.loading': 'Loading status…',
      'status.saving': 'Submitting…',
      'status.executing': 'Executing power action',
      'status.agents': 'Running agents',
      'status.inbox': 'Queued messages',
      'status.jobs': 'Background jobs',
      'countdown.cancelling': 'Cancelling…',
      'countdown.offline': 'Connection lost. The reservation may still run. Cancellation is unconfirmed; please retry.',
      'error.execution-in-progress': 'The power command is already executing and can no longer be cancelled.',
      'error.reservation-changed': 'The reservation just changed; please try again.',
      'error.command-unavailable': 'The power command could not be found; check the shutdownCommand setting.',
      'error.agents-unavailable': 'The agent registry is unavailable, so nothing can be scheduled right now.',
      'error.unsupported-platform': 'This plugin supports Windows only.',
      'panel.hibernate': 'Hibernate',
      'panel.hibernateDesc': 'Writes a memory snapshot to disk, so the next boot restores every open window and unsaved edit.',
      'panel.shutdown': 'Shut down',
      'panel.shutdownDesc': 'Shuts down Windows after the countdown. DSH conversations remain saved.',
      'panel.shutdownNote': 'Forces apps to close. Unsaved work may be lost; save your work in other apps first.',
      'panel.hibernateNote': 'After hibernating, pressing the power button reads the memory image back.',
      'panel.arm': 'Schedule',
      'panel.cancel': 'Cancel',
      'panel.close': 'Close',
      'status.idle': 'Not scheduled',
      'status.waiting': 'Waiting',
      'status.tasksSuffix': ' tasks running',
      'status.quietPrefix': 'All tasks stopped, ',
      'status.quietSuffix': 's until the countdown',
      'status.counting': 'Counting down',
      'status.failed': 'Failed',
      'status.offline': 'Cannot reach the plugin Host',
      'status.unsupported': 'This plugin supports Windows only',
      'status.registryUnavailable': 'Agent registry unavailable; countdown paused',
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
      'panel.background': 'Countdown background',
      'background.solid': 'Solid',
      'background.solidDesc': 'Opaque surface with the strongest text contrast.',
      'background.glass': 'Frosted glass',
      'background.glassDesc': 'Translucent with a blur; faintly shows the window behind.',
      'background.blur': 'Gaussian blur',
      'background.blurDesc': 'Heavy blur and a dark scrim; an immersive dark warning.',
    };

    // ---------------------------------------------------------------- styles
    const CSS = `
.ipa-fab{display:flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:none;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;position:relative;flex:none}
@media (hover:hover){.ipa-fab:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.ipa-fab:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:2px}
.ipa-fab[data-active]{color:var(--dsw-alias-brand-primary)}
.ipa-fab .ipa-dot{position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-brand-primary)}
.ipa-fab[data-phase=counting] .ipa-dot{background:var(--dsw-alias-state-error-primary)}
.ipa-entry{display:flex;align-items:center;gap:8px;width:100%;min-width:0;height:36px;padding:0 12px;box-sizing:border-box;border:none;border-radius:var(--dsw-radius-md);background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:13px;line-height:22px;text-align:left;position:relative}
@media (hover:hover){.ipa-entry:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}}
.ipa-entry:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-2px}
.ipa-entry .ipa-entryText{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ipa-entry[data-active]{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2);font-weight:500}
.ipa-entry[data-phase=counting]{color:var(--dsw-alias-state-error-primary)}
.ipa-entry .ipa-dot{position:static;flex:none;width:6px;height:6px;border-radius:50%;background:currentColor}
.ipa-entry[data-phase=counting] .ipa-dot{background:currentColor}
/* ---- countdown: the whole window is the warning, not a card in the middle ---- */
/* The scrim is the dialog's positioning and stacking context. The card below is
   opaque and always fills the viewport, so the mask only ever shows in the
   moment before layout settles — which is why it does no blur work. */
.ipa-scrim{position:fixed;inset:0;z-index:60;box-sizing:border-box;overflow:auto;overscroll-behavior:contain;background-color:var(--dsw-alias-bg-mask-3);color:var(--dsw-alias-label-primary);animation:ipa-fade .24s ease-out}
@media (prefers-reduced-motion:reduce){.ipa-scrim{animation:none}}
@keyframes ipa-fade{from{opacity:0}to{opacity:1}}
/* A rail pinned to the viewport edge keeps draining in peripheral vision even
   when the Harness window is stretched across two monitors, where dead centre
   can land on the bezel between them. */
.ipa-rail{position:fixed;top:0;left:0;right:0;height:clamp(4px,.7vmin,10px);z-index:2;background:var(--dsw-alias-border-l2);pointer-events:none}
.ipa-railFill{display:block;height:100%;width:100%;background:var(--dsw-alias-brand-primary);transition:width .26s linear,background-color .3s ease}
.ipa-isUrgent .ipa-railFill{background:var(--dsw-alias-state-error-primary)}
@media (prefers-reduced-motion:reduce){.ipa-railFill{transition:none}}
/* Three rows spanning the full viewport, no fixed card width: the information
   breathes with whatever monitor (or monitors) the window is on. The surface
   colour is the host's own overlay token, so its label tokens stay readable in
   BOTH themes — dark labels on the dark mask were illegible. */
.ipa-card{position:relative;box-sizing:border-box;width:100%;min-height:100vh;min-height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:clamp(10px,1.8vmin,30px);padding:clamp(24px,4vmin,64px) clamp(20px,4.4vmin,80px) clamp(18px,3vmin,48px);background-color:var(--dsw-alias-bg-overlay);background-image:radial-gradient(ellipse at 50% 38%,rgba(120,135,165,.07),transparent 72%);animation:ipa-rise .22s var(--ds-ease-out,ease-out)}
@media (prefers-reduced-motion:reduce){.ipa-card{animation:none}}
@keyframes ipa-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
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
.ipa-dialWrap{flex:0 0 auto;display:grid;place-items:center}
.ipa-dial{position:relative;display:grid;place-items:center;width:clamp(190px,52vmin,640px);height:clamp(190px,52vmin,640px)}
.ipa-ring{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);overflow:visible}
.ipa-ringTrack{fill:none;stroke:var(--dsw-alias-border-l2);stroke-width:2.4}
.ipa-ringValue{fill:none;stroke:var(--dsw-alias-brand-primary);stroke-width:2.4;stroke-linecap:round;transition:stroke-dashoffset .3s linear,stroke .3s ease}
@media (prefers-reduced-motion:reduce){.ipa-ringValue{transition:none}}
.ipa-dial[data-urgent] .ipa-ringValue{stroke:var(--dsw-alias-state-error-primary)}
.ipa-dialCenter{display:flex;align-items:baseline;gap:clamp(4px,.8vmin,12px);color:var(--dsw-alias-label-primary)}
.ipa-count{font-size:clamp(76px,21vmin,300px);font-weight:600;line-height:.9;letter-spacing:-.045em;font-variant-numeric:tabular-nums}
.ipa-unit{font-size:clamp(16px,2.4vmin,32px);font-weight:400;color:var(--dsw-alias-label-secondary)}
.ipa-dial[data-urgent] .ipa-dialCenter{color:var(--dsw-alias-state-error-primary)}
.ipa-dial[data-urgent] .ipa-unit{color:var(--dsw-alias-state-error-primary)}
.ipa-dial[data-urgent] .ipa-count{animation:ipa-pulse 1s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ipa-dial[data-urgent] .ipa-count{animation:none}}
@keyframes ipa-pulse{0%,100%{opacity:1}50%{opacity:.7}}
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
/* --- motion: every animation here encodes a state change, not decoration --- */
.ipa-panel{transform-origin:bottom left;animation:ipa-pop .17s var(--ds-ease-out,cubic-bezier(.16,1,.3,1))}
@keyframes ipa-pop{from{opacity:0;transform:translateY(7px) scale(.975)}to{opacity:1;transform:none}}
.ipa-modeOption{transition:background-color .16s var(--ds-ease-out,ease-out),border-color .16s var(--ds-ease-out,ease-out),color .16s var(--ds-ease-out,ease-out),transform .12s var(--ds-ease-out,ease-out)}
.ipa-modeOption:active:not(:disabled){transform:scale(.994)}
.ipa-primary,.ipa-cancel,.ipa-cta,.ipa-close,.ipa-entry{transition:background-color .15s var(--ds-ease-out,ease-out),color .15s var(--ds-ease-out,ease-out),box-shadow .15s var(--ds-ease-out,ease-out),transform .12s var(--ds-ease-out,ease-out)}
.ipa-primary:active:not(:disabled),.ipa-cancel:active:not(:disabled),.ipa-cta:active{transform:scale(.982)}
/* The countdown digit replays a short settle on every second so the eye
   registers that time is still moving even when it is not looking directly. */
.ipa-count{animation:ipa-tick .32s var(--ds-ease-out,ease-out)}
@keyframes ipa-tick{from{opacity:.5;transform:translateY(-2px) scale(1.035)}to{opacity:1;transform:none}}
/* The ring is driven by a fractional remaining value, so a linear transition
   spanning one update interval makes it sweep continuously instead of stepping. */
.ipa-ringValue{transition:stroke-dashoffset .26s linear}
/* A reservation that is running its countdown breathes; one merely armed only
   blinks its dot so it is noticeable without being alarming. */
.ipa-entry[data-active] .ipa-dot{animation:ipa-blink 2.4s ease-in-out infinite}
.ipa-entry[data-phase=counting] .ipa-dot{animation:ipa-blink .9s ease-in-out infinite}
@keyframes ipa-blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.8)}}
.ipa-entry[data-phase=counting]{animation:ipa-breathe 2.4s ease-in-out infinite}
@keyframes ipa-breathe{0%,100%{background-color:var(--dsw-alias-bg-layer-2)}50%{background-color:var(--dsw-alias-interactive-bg-hover)}}
@media (prefers-reduced-motion:reduce){
.ipa-panel,.ipa-count,.ipa-entry[data-active] .ipa-dot,.ipa-entry[data-phase=counting] .ipa-dot,.ipa-entry[data-phase=counting],.ipa-scrim,.ipa-card,.ipa-dial[data-urgent] .ipa-count{animation:none}
.ipa-ringValue,.ipa-railFill{transition:none}
.ipa-primary,.ipa-cancel,.ipa-cta,.ipa-close,.ipa-entry,.ipa-modeOption{transition:none}
.ipa-primary:active,.ipa-cancel:active,.ipa-cta:active,.ipa-modeOption:active{transform:none}
}
.ipa-panel{position:fixed;z-index:59;left:12px;bottom:150px;width:min(320px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow-y:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-overlay);border:.5px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);font-size:13px}
.ipa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.ipa-title{font-size:14px;font-weight:600}
.ipa-close{flex:none;width:22px;height:22px;border:none;background:0 0;color:var(--dsw-alias-label-tertiary);cursor:pointer;border-radius:var(--dsw-radius-xs);font-size:15px;line-height:1}
@media (hover:hover){.ipa-close:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}}
.ipa-sub{color:var(--dsw-alias-label-secondary);line-height:1.55;margin-top:-4px}
.ipa-modes{display:flex;flex-direction:column;gap:8px}
.ipa-modeOption{display:flex;flex-direction:column;gap:3px;text-align:left;padding:9px 11px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit;cursor:pointer;font-size:13px}
@media (hover:hover){.ipa-modeOption:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.ipa-modeOption[data-active]{border-color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-bg-layer-2)}
.ipa-modeOption .ipa-optionTitle{font-weight:600}
.ipa-modeOption .ipa-optionDesc{color:var(--dsw-alias-label-secondary);line-height:1.5;font-size:12px}
.ipa-note{color:var(--dsw-alias-label-tertiary);line-height:1.5;font-size:12px}
.ipa-status{padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);line-height:1.5}
.ipa-status[data-tone=error]{color:var(--dsw-alias-state-error-primary)}
.ipa-actions{display:flex;gap:8px}
.ipa-primary{flex:1;padding:9px 12px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-brand-primary);background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary-foreground);font-size:13px;font-weight:600;cursor:pointer}
.ipa-cancel{flex:1;padding:9px 12px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;cursor:pointer}
@media (hover:hover){.ipa-cancel:hover{background:var(--dsw-alias-interactive-bg-hover)}}
.ipa-primary:disabled,.ipa-cancel:disabled{opacity:.5;cursor:default}
.ipa-modeOption:disabled{opacity:.5;cursor:default}
.ipa-panel{width:min(360px,calc(100vw - 24px));gap:14px;overscroll-behavior:contain;overflow-wrap:anywhere}
.ipa-title{font-size:16px;line-height:1.4}
.ipa-close{width:32px;height:32px;font-size:20px}
.ipa-modeOption{padding:12px;gap:5px;min-height:44px}
.ipa-modeOption[data-active] .ipa-optionTitle::before{content:'✓';margin-right:8px;color:var(--dsw-alias-brand-primary)}
.ipa-modeOption:focus-visible,.ipa-close:focus-visible,.ipa-primary:focus-visible,.ipa-cancel:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:2px}
.ipa-primary,.ipa-cancel{min-height:44px}
/* Compact appearance picker in the popover: a group of toggle buttons (not a
   second radiogroup) so the mode radios stay the only radios in the panel. */
.ipa-bg{display:flex;flex-direction:column;gap:6px}
.ipa-bgHead{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.ipa-bgOptions{display:flex;gap:4px;padding:3px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1)}
.ipa-bgOption{flex:1;min-width:0;min-height:36px;padding:6px 8px;border:none;border-radius:var(--dsw-radius-xs);background:0 0;color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;cursor:pointer}
@media (hover:hover){.ipa-bgOption:not(:disabled):not([aria-pressed=true]):hover{background:var(--dsw-alias-interactive-bg-hover)}}
.ipa-bgOption[aria-pressed=true]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-brand-primary);font-weight:600;box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary)}
.ipa-bgOption:disabled{opacity:.5;cursor:default}
.ipa-bgOption:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary));outline-offset:1px}
.ipa-bgDesc{font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.ipa-flow{display:flex;flex-direction:column;gap:4px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l1);border-bottom:1px solid var(--dsw-alias-border-l1);line-height:1.5;color:var(--dsw-alias-label-secondary)}
.ipa-flow strong{color:var(--dsw-alias-label-primary);font-weight:500}
.ipa-details{display:grid;grid-template-columns:1fr auto;gap:5px 12px;margin:0;color:var(--dsw-alias-label-secondary);font-size:12px}
.ipa-details dd{margin:0;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.ipa-note{color:var(--dsw-alias-label-secondary)}
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
@media (max-width:480px){.ipa-dial{width:clamp(160px,58vmin,260px);height:clamp(160px,58vmin,260px)}.ipa-entry{min-height:44px}.ipa-close{width:44px;height:44px}}
/* A committed or failed power action must not look like an idle row. */
.ipa-entry[data-phase=executing]{color:var(--dsw-alias-brand-primary)}
.ipa-entry[data-phase=failed],.ipa-fab[data-phase=failed]{color:var(--dsw-alias-state-error-primary)}
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
     * Poll the Host, perform the two mutations, and own the panel's open flag.
     * One poller serves both slot entries so neither duplicates transport work.
     * @param ctx - Client root context.
     * @returns store handle, actions, and the poller body.
     */
    function createRuntime(ctx) {
      const store = createStore({ data: EMPTY_STATE, ready: false, offline: false, panelOpen: false, busy: false, note: null, noteCode: null, notePhase: null, anchor: null });
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
        // The panel is a popover anchored above its trigger: the foot row is
        // short, so a fixed offset would sit on top of the very button the user
        // just pressed. Capture the trigger rect and let the panel position
        // itself against it.
        open: (anchor) => patch({ panelOpen: true, anchor: anchor ?? null }),
        close: () => patch({ panelOpen: false }),
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
      fill.style.cssText = 'height:100%;width:100%;background:#4a8cff;transition:width .25s linear';
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
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size ?? 16,
        height: size ?? 16,
        'aria-hidden': true,
        style: { display: 'block' },
      },
        h('path', {
          d: 'M12 3.2v8.1',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M6.4 6.6a8.1 8.1 0 1 0 11.2 0',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
        }),
      );
    }

    /**
     * Sidebar-foot trigger. Expanded sidebar renders a full-width row with a
     * readable label, because a bare 28px glyph beside the plugin button is
     * effectively invisible. A live reservation also changes the row's colour,
     * so a pending power action can never be forgotten in the corner.
     */
    function PowerButton({ usePower, open, t, wide }) {
      const { data, offline, panelOpen } = usePower((current) => current);
      const active = data.phase === 'armed' || data.phase === 'counting';
      const counting = data.phase === 'counting';
      // Hand the trigger's own rect to the panel so it opens above this row
      // instead of over it.
      const openHere = (event) => {
        const rect = event?.currentTarget?.getBoundingClientRect?.();
        open(rect === undefined ? null : { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
      };

      if (!wide) {
        const dotLabel = !data.supported
          ? t('status.unsupported')
          : offline
            ? t('status.offline')
            : data.busy?.available === false
              ? t('status.registryUnavailable')
              : counting
              ? t('status.counting')
              : active
                ? t('status.waiting')
                : t('button.tip');
        return h('button', {
          type: 'button',
          className: 'ipa-fab',
          'data-ipa-trigger': '',
          'aria-label': dotLabel,
          'aria-haspopup': 'dialog',
          'aria-expanded': Boolean(panelOpen),
          title: dotLabel,
          'data-active': active || undefined,
          'data-phase': data.phase,
          onClick: openHere,
        },
          h(PowerGlyph, { size: 16 }),
          active && h('span', { className: 'ipa-dot', 'aria-hidden': 'true' }),
        );
      }

      // Name the action that will actually run. "预约关机" alone was wrong:
      // hibernate is the default mode, and it is not a shutdown.
      const modeName = data.mode === 'shutdown' ? t('mode.shutdown.short') : t('mode.hibernate.short');
      let text;
      if (!data.supported) text = t('status.unsupported');
      else if (offline) text = t('status.offline');
      else if (data.busy?.available === false) text = t('status.registryUnavailable');
      else if (data.phase === 'failed') text = t('status.failed');
      else if (data.phase === 'executing') text = t('status.executing');
      else if (counting) text = `${data.remainingSeconds}${t('entry.secondsTo')}${modeName}`;
      else if (active && data.busy.total > 0)
        text = `${t('status.waiting')} · ${data.busy.total}${t('status.tasksSuffix')}`;
      else if (active) text = `${t('status.waiting')} · ${data.quietRemainingSeconds}${t('entry.quietSuffix')}`;
      else text = `${t('entry.schedulePrefix')}${modeName}`;

      return h('button', {
        type: 'button',
        className: 'ipa-entry',
        'data-ipa-trigger': '',
        'aria-label': text,
        'aria-haspopup': 'dialog',
        'aria-expanded': Boolean(panelOpen),
        title: text,
        'data-active': active || undefined,
        'data-phase': data.phase,
        onClick: openHere,
      },
        h(PowerGlyph, { size: 15 }),
        h('span', { className: 'ipa-entryText' }, text),
        active && h('span', { className: 'ipa-dot', 'aria-hidden': 'true' }),
      );
    }

    /** The scheduling panel: mode choice, appearance, live status, arm and cancel. */
    function PowerPanel({ usePower, arm, cancel, setMode, setBackground, close, t }) {
      const { data, ready, offline, busy, note, noteCode, anchor } = usePower((current) => current);
      const panelRef = useRef(null);
      useEffect(() => {
        const previous = document.activeElement;
        panelRef.current?.focus?.();
        const onKey = (event) => {
          if (event.key === 'Escape') { close(); previous?.focus?.(); }
        };
        // A pointer press anywhere outside the card dismisses it, the way every
        // other popover in this app behaves.
        const onPress = (event) => {
          const target = event.target;
          if (panelRef.current !== null && panelRef.current.contains?.(target) === true) return;
          if (typeof target?.closest === 'function' && target.closest('[data-ipa-trigger]') !== null) return;
          close();
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('pointerdown', onPress, true);
        return () => {
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('pointerdown', onPress, true);
        };
      }, [close]);

      // Open above the trigger row. Falling back to the old fixed offset keeps
      // the panel usable if the rect was never captured.
      const hasAnchor = anchor !== null && anchor !== undefined && Number.isFinite(anchor.top) && Number.isFinite(anchor.left);
      const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
      const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
      const placement = hasAnchor
        ? {
          left: Math.max(8, Math.min(anchor.left, viewportWidth - 372)),
          bottom: anchor.top < 360 ? 12 : Math.max(12, viewportHeight - anchor.top + 8),
        }
        : { left: 12, bottom: 150 };

      const mode = data.mode;
      const background = normalizeBackground(data.backgroundStyle);
      const armed = data.phase === 'armed' || data.phase === 'counting';
      const locked = data.phase === 'executing';
      const styleChoices = [
        ['solid', 'background.solid', 'background.solidDesc'],
        ['glass', 'background.glass', 'background.glassDesc'],
        ['blur', 'background.blur', 'background.blurDesc'],
      ];

      let statusText;
      let statusTone = 'normal';
      if (!data.supported) statusText = t('status.unsupported');
      else if (note !== null) {
        statusText = `${t('status.failed')}: ${describeFailure(noteCode, note, t)}`;
        statusTone = 'error';
      } else if (offline) { statusText = t('status.offline'); statusTone = 'error'; }
      else if (!ready) statusText = t('status.loading');
      else if (data.busy?.available === false) { statusText = t('status.registryUnavailable'); statusTone = 'error'; }
      else if (data.phase === 'failed') {
        statusText = `${t('status.failed')}: ${data.error ?? ''}`;
        statusTone = 'error';
      } else if (data.phase === 'counting') statusText = `${t('status.counting')} · ${data.remainingSeconds}${t('countdown.suffix')}`;
      else if (data.phase === 'armed' && data.busy.total > 0)
        statusText = `${t('status.waiting')} · ${data.busy.total}${t('status.tasksSuffix')}`;
      else if (data.phase === 'armed')
        statusText = `${t('status.quietPrefix')}${data.quietRemainingSeconds}${t('status.quietSuffix')}`;
      else if (data.phase === 'executing') statusText = t('status.executing');
      else statusText = t('status.idle');

      const option = (value, titleKey, descKey, noteKey) => h('button', {
        type: 'button',
        className: 'ipa-modeOption',
        'data-active': mode === value || undefined,
        disabled: locked || busy || !ready || offline || !data.supported || data.busy?.available === false,
        tabIndex: mode === value ? 0 : -1,
        onKeyDown: (event) => {
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const choices = Array.from(event.currentTarget.parentElement.querySelectorAll('[role="radio"]'));
          const target = event.key === 'Home' ? choices[0] : event.key === 'End' ? choices[1] : choices.find((item) => item !== event.currentTarget);
          target?.focus();
          target?.click();
        },
        onClick: () => {
          if (value === data.mode) return;
          // While reserved, changing the mode re-arms with it; while idle it
          // just records what 预约 would do, so the entry label follows.
          if (armed) void arm(value);
          else void setMode(value);
        },
        role: 'radio',
        'aria-checked': mode === value,
      },
        h('span', { className: 'ipa-optionTitle' }, t(titleKey)),
        h('span', { className: 'ipa-optionDesc' }, t(descKey)),
        mode === value && noteKey !== undefined && h('span', { className: 'ipa-note' }, t(noteKey)),
      );

      return h('div', {
        className: 'ipa-panel',
        ref: panelRef,
        role: 'dialog',
        tabIndex: -1,
        'aria-label': t('panel.title'),
        'aria-busy': busy,
        style: { left: `${placement.left}px`, bottom: `${placement.bottom}px`, maxHeight: `${Math.max(80, viewportHeight - placement.bottom - 12)}px` },
      },
        h('div', { className: 'ipa-head' },
          h('span', { className: 'ipa-title' }, t('panel.title')),
          h('button', {
            type: 'button',
            className: 'ipa-close',
            'aria-label': t('panel.close'),
            onClick: close,
          }, '\u00d7'),
        ),
        h('div', { className: 'ipa-sub' }, t('panel.subtitle')),
        h('div', { className: 'ipa-modes', role: 'radiogroup', 'aria-label': t('panel.mode') },
          option('hibernate', 'panel.hibernate', 'panel.hibernateDesc', 'panel.hibernateNote'),
          option('shutdown', 'panel.shutdown', 'panel.shutdownDesc', 'panel.shutdownNote'),
        ),
        h('div', { className: 'ipa-bg' },
          h('div', { className: 'ipa-bgHead' }, t('panel.background')),
          h('div', { className: 'ipa-bgOptions', role: 'group', 'aria-label': t('panel.background') },
            ...styleChoices.map(([value, labelKey]) => h('button', {
              type: 'button',
              key: value,
              className: 'ipa-bgOption',
              'aria-pressed': background === value,
              'aria-label': t(labelKey),
              disabled: locked || busy || !ready || offline || !data.supported,
              onClick: () => { if (value !== background) void setBackground(value); },
              onKeyDown: (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                const parent = event.currentTarget?.parentElement;
                if (parent === null || parent === undefined || typeof parent.querySelectorAll !== 'function') return;
                event.preventDefault?.();
                const choices = Array.from(parent.querySelectorAll('.ipa-bgOption'));
                const index = choices.indexOf(event.currentTarget);
                const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
                const target = event.key === 'Home' ? choices[0]
                  : event.key === 'End' ? choices[choices.length - 1]
                    : choices[(index + step + choices.length) % choices.length];
                target?.focus?.();
                target?.click?.();
              },
            }, t(labelKey))),
          ),
          h('div', { className: 'ipa-bgDesc' }, t(`background.${background}Desc`)),
        ),
        h('div', { className: 'ipa-flow', 'aria-label': t('panel.flow') },
          h('strong', null, `${data.quietSeconds} ${t('panel.quiet')} → ${data.countdownSeconds} ${t('panel.countdown')}`),
          h('span', { className: 'ipa-note' }, t('panel.scope')),
        ),
        h('div', { className: 'ipa-status', 'data-tone': statusTone, role: 'status' }, statusText),
        armed && data.busy.total > 0 && h('dl', { className: 'ipa-details' },
          [['agentsRunning', 'status.agents'], ['inboxPending', 'status.inbox'], ['jobsRunning', 'status.jobs']]
            .flatMap(([key, label]) => [
              h('dt', { key: `${key}-t` }, t(label)),
              h('dd', { key: `${key}-d` }, String(data.busy[key] ?? 0)),
            ]),
        ),
        // Exactly one primary action: arm while idle, cancel while reserved.
        // Showing both at once was the reason an armed reservation still looked
        // unarmed.
        h('div', { className: 'ipa-actions' },
          armed
            ? h('button', {
              type: 'button',
              className: 'ipa-cancel',
              disabled: busy,
              onClick: () => { void cancel(); },
            }, t(busy ? 'countdown.cancelling' : 'panel.cancel'))
            : h('button', {
              type: 'button',
              className: 'ipa-primary',
              disabled: busy || !ready || offline || !data.supported || locked || data.busy?.available === false,
              onClick: () => { void arm(mode); },
            }, t(locked ? 'status.executing' : busy ? 'status.saving' : 'panel.arm')),
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
      const railWidth = `${(fraction * 100).toFixed(2)}%`;

      // Seconds only, so the title changes once a second rather than four times.
      useEffect(() => {
        try { document.title = `${remaining}${t('countdown.suffix')} · ${action}`; } catch { /* host owns the title */ }
      }, [remaining, action, t]);

      // Mirrors have no script of their own; this window drives every update.
      useEffect(() => {
        for (const handle of mirrorsRef.current) {
          try {
            handle.count.textContent = String(remaining);
            handle.fill.style.width = railWidth;
            handle.fill.style.backgroundColor = urgent ? '#ff6b6b' : '#4a8cff';
            handle.count.style.color = urgent ? '#ff6b6b' : '#f3f5f9';
            handle.action.textContent = action;
            handle.meta.textContent = fmt(t('countdown.scheduledAt'), scheduledAt);
          } catch { /* a closed mirror is harmless */ }
        }
      }, [remaining, action, scheduledAt, railWidth, urgent, t]);

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
          h('span', { className: 'ipa-railFill', style: { width: railWidth } }),
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
                  // Re-keying on the whole second restarts the tick animation,
                  // which makes the digit visibly settle once per second.
                  h('span', { className: 'ipa-count', key: remaining }, String(remaining)),
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
              h('p', { className: 'ipa-hint' }, t('panel.scope')),
              extended && h('p', { className: 'ipa-hint' }, t('countdown.multiNote')),
              data.mode === 'shutdown' && h('p', { className: 'ipa-hint ipa-hintWarn' }, t('panel.shutdownNote')),
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

        ctx.effect(() => {
          const tag = document.createElement('style');
          tag.dataset.plugin = 'dsh-idle-power';
          tag.dataset.pluginCss = 'dsh-idle-power/dsh-idle-power.css';
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => { tag.remove(); };
        }, 'dsh-idle-power: stylesheet');

        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-idle-power: dictionaries');

        // One poller for both entries: 1s while armed, a slow 3s otherwise.
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

        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'dsh-idle-power',
          order: 10,
          locale: NS,
          inject: () => ({ hooks: { power: runtime.store }, open: runtime.open }),
        }, PowerButton));

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'dsh-idle-power.panel',
          order: 10,
          locale: NS,
          inject: () => ({
            hooks: { power: runtime.store },
            arm: runtime.arm,
            cancel: runtime.cancel,
            setMode: runtime.setMode,
            setBackground: runtime.setBackground,
            close: runtime.close,
          }),
        }, function PanelWhenOpen({ usePower, ...rest }) {
          const { panelOpen } = usePower((current) => current);
          return panelOpen ? h(PowerPanel, { usePower, ...rest }) : null;
        }));

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
