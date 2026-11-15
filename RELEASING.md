# 发布流程 / Releasing

发布由 [Release Please](https://github.com/googleapis/release-please) 驱动，全部在 GitHub Actions 里完成，不需要本地手动改版本号。

## 一句话流程

往 `main` 合并 Conventional Commits → Release Please 自动开「发布 PR」→ 你审阅并合并这个 PR → 自动打 tag、建 GitHub Release、发布到 npm。

## 1. 写提交信息

版本号来自提交信息，所以标题必须遵守 [Conventional Commits](https://www.conventionalcommits.org/)：

| 前缀 | 版本变化 | 是否进 CHANGELOG |
|---|---|---|
| `fix:` | `0.2.0` → `0.2.1` | ✅ Bug Fixes |
| `feat:` | `0.2.0` → `0.3.0` | ✅ Features |
| `feat!:` 或 `BREAKING CHANGE:` footer | 破坏性变更 | ✅ |
| `perf:` / `revert:` | patch | ✅ |
| `docs:` `style:` `chore:` `refactor:` `test:` `build:` `ci:` | **不涨版本** | 隐藏 |

例子：

```
feat: add a cancellable quiet-window override
fix(host): refuse an arm whose executable lookup resolved out of order
ci: add GitHub Actions and Release Please
```

CI 会在 PR 上校验**每一个 commit 的标题**和 **PR 标题**（squash 合并时 PR 标题会变成 main 上的 commit message）。不符合规范的 PR 会变红。不符合规范的提交会被 release-please 静默丢弃——版本号因此不涨，所以这个检查是必要的，不是形式主义。

## 2. 合并到 main

`ci.yml` 跑测试（Windows / Ubuntu / macOS × Node 20 / 24）和提交规范检查。因为 `index.js` 用 `process.platform === 'win32'` 判断平台，而 `host.test.mjs` 断言可以正常 arm 并倒计时，**Host 套件只在 Windows runner 上跑**；浏览器半的 `client.test.cjs` 与平台无关，在全部 6 个组合上跑。等 Host 半把平台改成可注入的，这两个 step 就能合并回一个 `npm test`。

合并后 `release.yml` 在 `main` 上触发：

- 有 `feat` / `fix` 等用户可见的提交 → 自动打开或更新一个名为 `chore(main): release X.Y.Z` 的发布 PR。这个 PR 只改三处：`package.json` 的版本、`CHANGELOG.md`、`.release-please-manifest.json`。
- 只有 `ci:` / `chore:` 等隐藏类型的提交 → **不会**打开发布 PR，这是预期行为，不是故障。

发布 PR 会随着后续合并持续更新，攒够一批再发。

## 3. 审阅并合并发布 PR

合并发布 PR 的那一刻，`release.yml` 会：

1. 创建 tag `vX.Y.Z` 和对应的 GitHub Release（正文来自 CHANGELOG）；
2. 在同一个 workflow run 里校验版本号、跑浏览器半的测试、`npm pack --dry-run`，然后 `npm publish --access public`。

之所以把 npm 发布放在同一个 workflow，而不是监听 `release: published`：用内置 `GITHUB_TOKEN` 创建的事件不会再触发其它 workflow，那样发布 job 永远不会跑。

## 4. npm 认证 —— 已经配好，不需要密钥

`dsh-idle-power` 用的是 **npm Trusted Publishing（OIDC）**，仓库里**没有** `NPM_TOKEN` secret，也不需要有人维护长期密钥。发布时 GitHub Actions 用 `id-token: write` 换取一个短效凭证，npm 同时自动生成 provenance。

已生效的配置：

| 项 | 值 |
|---|---|
| 包 | `dsh-idle-power`（id `5692fd88-9b5f-42af-8440-fd088be9f4c1`） |
| Organization or user | `tzzs` |
| Repository | `tzzs/dsh-idle-power` |
| Workflow filename | `release.yml` |
| Permissions | `npm publish` + `npm stage publish` |

用 CLI 核对：

```powershell
npm trust list dsh-idle-power --registry https://registry.npmjs.org/
```

⚠️ **不要改 `release.yml` 的文件名** —— trusted publisher 绑定的是这个文件名，改名会让发布立刻以 `ENEEDAUTH` 失败。改动绑定要删掉旧的再加新的：

```powershell
npm trust revoke dsh-idle-power --id <id> --registry https://registry.npmjs.org/
npm trust github dsh-idle-power --file release.yml --repo tzzs/dsh-idle-power --allow-publish
```

这两个命令都需要交互式 2FA（安全密钥/验证器）。

**历史包袱**：`0.2.0` 是在接上自动化之前手动发布的，因此没有 provenance；同时 npm 对新包会先占位一个 `0.0.0-stage` 空版本，这个版本无害、可以忽略。从 `0.2.1` 起全部由 CI 带 provenance 发布。

## 5. 可选：让 CI 也跑在发布 PR 上

内置 `GITHUB_TOKEN` 创建的 PR 不会自动触发其它 workflow，GitHub 会把那次 CI 挂成 **`action_required`**（等你点批准才跑），所以发布 PR 上不会自己出现绿色勾。这不影响发布 —— 发布 PR 只改 `package.json` / `CHANGELOG.md` / manifest 三处，而合并后的那次 `ci.yml`（push 到 main）仍会跑全量测试。

想要发布 PR 自己也带 CI，二选一：

1. 在这个 PR 的 Checks 里手动点 **Approve and run workflows**（一次性，最省事）；
2. 配一个 PAT 让 release-please 用它建 PR，就再也不会卡审批：
   ```powershell
   gh secret set RELEASE_PLEASE_TOKEN -R tzzs/dsh-idle-power
   ```
   PAT 用 classic（`repo` scope）或 fine-grained（Contents RW + Pull requests RW）。`release.yml` 已经写成优先读它、缺失时回退 `GITHUB_TOKEN`，不需要改代码。

仓库设置里的 "Allow GitHub Actions to create and approve pull requests" 已经打开。

## 关键文件

| 文件 | 作用 |
|---|---|
| `release-please-config.json` | 版本策略、CHANGELOG 分节、tag 格式 |
| `.release-please-manifest.json` | 当前已发布版本 |
| `.github/workflows/ci.yml` | 测试 + 提交规范 |
| `.github/workflows/release.yml` | 发布 PR → tag / Release → npm |
| `.github/scripts/lint-commit-subjects.mjs` | 无依赖的提交标题校验 |

`bootstrap-sha` 指向接入前的 `main` 顶点，用来把历史里 4 个非规范提交排除在 CHANGELOG 之外；`v0.2.0` 这个 Release 存在之后，它就不再被使用了。

## 实际跑通记录

| 版本 | tag / Release | npm | 谁发布的 |
|---|---|---|---|
| `0.2.0` | `v0.2.0` | ✅ `latest`（后由 0.2.1 接替） | 手动（当时还没有 trusted publisher） |
| `0.2.1` | `v0.2.1` | ✅ `latest` + SLSA provenance | GitHub Actions（OIDC，无密钥） |
