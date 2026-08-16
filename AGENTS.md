# AGENTS.md — dsh-achievements

> 给 AI 协作者的项目速览。修改本项目前先读这里；`routing/` 下是分阶段任务计划（P0–P7，00–21 已全部实现）。

## 一句话

DeepSeek Harness（DSH）的成就/游戏化插件，**双面包架构**：Host（Node，事件统计 + 纯引擎 + 持久化 + HTTP/SSE）+ Browser（徽章墙 + Toast + 轮询/推送）。零核心改动，只读官方事件缝。

## 架构与数据流

```
DSH session/event（turn/end、step/start、assistant/message、step/end、tool/call、tool/result、tool/code-dispatch）
  → src/events.ts 分类器（classifyTool / classifyCodeDispatch → ToolSummary.kind：file-read / file-edit / shell-command / test-run / other）
  → src/reducer.ts reduceState（profile 累计 + 当前 session 行为统计 + P7 轨迹事实）
  → src/achievements.ts applyEvent（buildContext + 对每个 def evaluate → 解锁 + 发 XP + 记本 session 归属）
  → src/index.ts 持久化 saveState → SSE 推送（unlock）+ 只读 HTTP API；启动时静默 reconcile lifetime 成就
  → src/client/（EventSource 实时 + 30s 轮询兜底）→ badge-panel / toast
```

三层分离可独立单测：**classifier（原始 payload → 标准事件）→ reducer（事件 → 状态）→ evaluate（状态 → 解锁）**。规则层永远不直接读 Harness tool payload。

## 目录与职责

| 文件 | 职责 | 运行时 |
|---|---|---|
| `src/index.ts` | Host 入口：事件接线、registry、持久化、HTTP + SSE、SDK 导出 | Host |
| `src/state.ts` | State v2（`profile` + `sessions`）、migration、持久化 JSON | Host |
| `src/events.ts` | 事件分类器（标准 `AchievementEvent` + `ToolSummary` + `isTestCommand`） | Host |
| `src/reducer.ts` | 纯 reducer `reduceState` + `buildContext` + `yesterdayOf` | Host |
| `src/achievements.ts` | 领域模型 v2 + 引擎 `applyEvent` + 内置成就（`BUILTIN_PACK`）+ 兼容适配 | Host |
| `src/sdk.ts` | `createAchievementRegistry` + `AchievementPack`（重复 id 抛错） | Host |
| `src/gamification.ts` | `levelOf`/`xpForLevel` + `RARITY_META`（浏览器安全） | 两端 |
| `src/profile.ts` | Profile ViewModel + `personaOf` + rarity 汇总 + session 战报（浏览器安全） | 两端 |
| `src/share.ts` | 分享卡 / Agent Wrapped / 成就链（浏览器安全，隐私安全） | 两端 |
| `src/api.ts` | API 路径常量 + SSE 帧格式（浏览器安全） | 两端 |
| `src/client/index.ts` | 浏览器入口：轮询 + SSE + `ctx.achievementsState` + 槽位注入 | Client |
| `src/client/achievements-client.ts` | 状态 HTTP client（snapshot + subscribe） | Client |
| `src/client/badge-panel.tsx` | 设置页（Profile / 成就墙 / 战报 / Wrapped / 链 / 分享） | Client |
| `src/client/toast.ts` | 解锁 Toast（零依赖 DOM，rarity/XP/flavorText） | Client |
| `src/client/unlock-tracker.ts` | Toast 基线去重（P0 修复，纯函数） | Client |
| `tests/*.spec.ts` | 18 个测试文件，逐层覆盖（classifier/reducer/evaluate/state/sdk/chains/reconciliation/trajectory/…） | — |
| `docs/SDK.md` + `examples/python-pack.ts` | 第三方作者文档 + 示例 Pack | — |

## 关键不变量（改动前必须理解）

- **State v2**：`{ version: 2, profile, sessions }`。`profile` 是跨会话 lifetime，`sessions[<id>]` 是单会话行为桶（`touchSession` 按「删后重加」保序并裁到 `MAX_SESSIONS=64`）。旧 v1 `{counters,...}` 由 `migrateState` 无损迁移。
- **引擎**：`applyEvent(state, event, defs, today, now)` = `reduceState` → `buildContext` → 对每个未解锁 def `evaluate(ctx)` → 解锁（写 `profile.unlocked[id]`）+ 发 XP（只发一次，靠 `id in unlocked` 守卫）+ 记 `session.unlocked/xpGained`。
- **SDK 单一路径**：内置成就以 `BUILTIN_PACK` 进 `createAchievementRegistry()`，第三方 Host 插件用 `ctx.achievements.register/registerPack` 注册，引擎求值 `registry.list()`。重复 id **抛异常**。
- **浏览器安全模块划分（重要）**：client bundle 只能运行时 import 不含 `node:*` / 未白名单 `@deepseek-ai/*` 的模块。`state.ts`（`node:fs`）、`achievements.ts`（→reducer→state）是 Host-only；client 对它们只能 `import type`。`api.ts`/`gamification.ts`/`profile.ts`/`share.ts`/`unlock-tracker.ts` 是浏览器安全的。`tsdown.config.ts` 的纯度门禁会拦截越界 import。
- **隐私边界**：`buildShareText`/`buildAgentWrapped` 只读聚合计数、成就元数据、persona/level，**不读** `filesRead/filesEdited/commands`（含路径/命令）。
- **进度**：`computeProgress(defs, ctx)` 用「最近活跃 session」建 ctx（`Object.keys(state.sessions).at(-1)`），随状态 API 下发。
- **P6 长期成长（48 成就）**：`profile` 新增 6 个 lifetime counters（`activeDays/fileReads/fileEdits/testRuns/testPasses/testFailures`）；它们只由 reducer 实时累计，**不**从 64 个 session 桶推导。旧 v2 缺字段时 `normalizeV2` 做 conservative lower-bound backfill（persisted 值永远优先，含显式 0）。内置成就 = 8 个 legacy lifetime + 30 个新 milestone + 10 个 behavior，共 48。
- **七条五级成长线**：`share.ts` 的 `MILESTONE_CHAINS` 定义 7 条 formal chain（turns/tools/sessions/active-days/file-reads/file-edits/tests），每条恰好 5 个节点、rarity 严格 `common → uncommon → rare → epic → legendary`。`SPECIAL_CHAINS` 含 streaks + behavior + 4 条 P7 trajectory chain。Badge Wall 的分组同源自这些 chain，不在 JSX 硬编码 35 个 milestone id 或 20 个 trajectory id。
- **P7 轨迹行为（20 成就，48 → 68）**：Session 桶新增 O(1) 轨迹事实（`trajectoryTurns/steps/maxStepsInTurn/openStep/currentStepToolCalls/maxToolCallsInStep/lastRequestDurationMs/maxRequestDurationMs` 等），只由 `step/start`、`assistant/message`、`step/end`、settled `tool-call` 四个低频边界驱动，**不消费 `assistant/chunk`**。`openStep` 同时支撑 request duration 配对与 tool burst 计数；`trajectoryTurns` 按「有至少一个 closed step 的 distinct turn」统计。duration 成就内部存 ms、UI progress 用 `Math.floor(ms/1000)` 秒。四条新链（session-marathon/turn-depth/tool-barrage/time-anomaly）各 5 节点、XP 固定 10/20/40/70/120；time-anomaly 全 hidden。P7 session 成就**不做 startup reconciliation / 历史 backfill**。
- **Lifetime Milestone helper**：`createLifetimeMilestone({ target, value(profile) })` 生成 `{ unlocked: progress >= target, progress, target }`，progress 不 clamp。`fromCounterCondition()` 仍保留（public 兼容），`createLifetimeMilestone` 是内部 helper，不进 public SDK 面。P7 对应的 `createSessionMilestone({ target, value(session) })` 同理内部，不进 public SDK 面。
- **静默 reconcile**：`reconcileLifetimeAchievements(state, defs)` 只补解锁 `scope === 'lifetime'` 且已满足的成就，幂等（`id in unlocked` 守卫），不 reducer、不写 session、不广播 SSE。Host 启动时对 builtin、SDK `register/registerPack` 时对第三方 pack 各跑一次。
- **Code Mode 已接入**：`tool/code-dispatch`（settled 子调用）经 `classifyCodeDispatch` 复用 `classifyTool`，与原生路径产出等价 `ToolSummary`；`arguments` 已是 JSON-normalized 对象（非字符串），`isError` 直接取 `event.data.isError`。

## 常用命令

```bash
# 首次（DSH 包用本地运行时 symlink）
npm install --legacy-peer-deps
$env:DSH_NODE_MODULES = "$env:USERPROFILE\.dsh\profiles\node_modules"
npm run setup:dsh-workspace

npm test                  # vitest（18 文件，当前 237 用例）
npm run typecheck         # tsc src + tests --noEmit
npm run build             # tsc 发射 lib/ + tsdown 打 lib/client.js
npm run verify            # clean + typecheck + test + build 一键门禁
```

## 安装到 DSH（本机已装）

```bash
npm pack --ignore-scripts          # 生成 dsh-achievements-0.1.0.tgz
node "<...>\@deepseek-ai\dsh\lib\bin.js" plugin --profile web remove dsh-achievements
node "<...>\@deepseek-ai\dsh\lib\bin.js" plugin --profile web add "<绝对路径>\dsh-achievements-0.1.0.tgz"
```

dsh CLI 在本机不在 PATH，位于 `D:\software\dsh_desktop\DeepSeek Harness\resources\host\node_modules\@deepseek-ai\dsh\lib\bin.js`。装完需**重启 DSH** 生效。

## 已知坑

- **`unrun` 缺失**：`npm run build` 会因 tsdown 的 optional peer `unrun` 未安装而失败（`Failed to import module "unrun"`）。本地已 `npm install --no-save unrun` 解决；若要根治，把它加进 `devDependencies`（连同 peer `synckit`）。Node 需 ≥22.19，本机 22.14 会出 EBADENGINE 警告但可构建。
- **Windows `link:` 安装损坏**：`dsh plugin add link:.` 会把 junction 目标拼坏（`profiles\web\F:\...`），导致 `exportsPatch` 判不出 bundle。**用 `npm pack` + tarball 安装**，别用 `link:`。
- **`lib/` 是产物**：已提交，由 `npm run build` 重建，勿手改。

## 约定

- 代码注释与文档用中文；UTF-8 无 BOM。
- 引擎/reducer/分类器/派生逻辑全部是纯函数、可独立单测（不依赖 DSH 运行时）。
- 相似功能统一实现（如所有 rarity 用 `RARITY_META`，所有 level 用 `levelOf`）。
- 改完跑 `npm run typecheck` + `npm test`；涉及 client 还要 `npm run build` 确认纯度门禁通过。
- 结构/接口级改动先确认方案，局部缺陷用最小必要修改。
