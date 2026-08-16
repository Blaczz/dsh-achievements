# dsh-achievements 🏆

> DeepSeek Harness 成就/游戏化插件：跨会话的成就徽章系统——自动累计回合、工具调用、会话数与连续天数，解锁时弹 toast，设置页有完整徽章墙，并提供 `ctx.achievements` 服务。零核心改动。本仓库是 [Blaczz/dsh-achievements](https://github.com/Blaczz/dsh-achievements) 的 fork，在其基础上新增行为成就、`ctx.achievements` SDK 与分享层。

[English](./README.md) | 简体中文

**DeepSeek Harness（DSH）** 的游戏化插件：它默默统计你的真实使用（回合、工具调用、会话、连续天数），达到里程碑即解锁成就，实时弹 toast 庆祝，在设置页展示徽章墙。状态跨会话持久化（存在 DSH 主目录），所有统计走官方 `session/event` 事件缝（`turn/end`、`tool/call`、`tool/result`），**不改动任何核心代码**。

## ✨ 内置成就（68 个）

成就分两条产品线。**七条长期成长线**各含五档，稀有度严格 `普通 → 罕见 → 稀有 → 史诗 → 传说`（新增里程碑 XP 为 10 / 30 / 75 / 175 / 400）：

| 成长线 | 普通 | 罕见 | 稀有 | 史诗 | 传说 |
|---|---:|---:|---:|---:|---:|
| 🎬 回合 | 1 | 25 | 50 | 100 | 500 |
| 🔧 工具调用 | 1 | 25 | 100 | 500 | 2000 |
| 💬 会话 | 1 | 10 | 50 | 200 | 500 |
| 🌅 活跃天数 | 1 | 7 | 30 | 100 | 365 |
| 📖 文件读取 | 10 | 100 | 500 | 2500 | 10000 |
| ✏️ 文件修改 | 1 | 10 | 50 | 250 | 1000 |
| 🧪 测试运行 | 1 | 10 | 50 | 250 | 1000 |

另有**特殊成就**：连续天数（`streak-3` / `streak-7`）、早期额外节点 `ten-turns`，以及 10 个单会话行为徽章：

| 成就 | 条件 |
|---|---|
| 🔁 似曾相识 | 同一文件修改 5 次 |
| 🕳 兔子洞 | 第一次修改前读取 20 个文件 |
| 💣 先斩后奏 | 第一次测试前修改 8 个文件 |
| 🔥 终于通了 | 测试失败 5 次后成功 |
| 🎰 这次一定 | 同一测试命令连续失败 5 次 |
| 🎯 一发入魂 | 只改一次，首次测试即通过 |
| 📚 图书管理员 | 单会话读取 30 个不同文件 |
| 🌱 出门走走 | 单会话工具调用 100 次 |
| 🦴 依赖考古学家 | 读取依赖目录（node_modules / site-packages / vendor）下的文件 |
| 🗿 巨佬模式 | ≤5 次工具调用内完成 读→改→测 且通过 |

P7 新增 20 个**会话轨迹成就**，分四条五档特殊链（稀有度严格 `普通 → 罕见 → 稀有 → 史诗 → 传说`，XP 10 / 20 / 40 / 70 / 120）。统计只读 `step/start` / `assistant/message` / `step/end` 与 settled 工具调用等低频边界，不逐 token 持久化：

| 链 | 指标 | 五档阈值 |
|---|---|---|---|
| 💬 会话马拉松 | 单会话完成回合数（按有 closed step 的 distinct turn 计） | 5 / 20 / 50 / 100 / 200 |
| 🪜 单轮深潜 | 单回合内关闭的步骤数（按 `step/end` 计） | 5 / 20 / 50 / 100 / 500 |
| 🔧 工具齐射 | 单步骤内 settled 工具调用数（含 Code Mode 子调用） | 5 / 10 / 25 / 50 / 100 |
| ⏳ 时间异象 | 单次模型请求思考耗时（`step/start → assistant/message`，隐藏彩蛋） | 30s / 100s / 300s / 500s / 1000s |

长期计数（`turns`、`toolCalls`、`sessions`、`activeDays`、`fileReads`、`fileEdits`、`testRuns`）都落在 profile 上，不依赖 64 个会话保留窗口。升级旧状态时，缺失计数会尽可能从仍保留的近期会话恢复为“可证明下界”，已满足的长期里程碑会静默补解锁一次（不会连续弹 toast）。P7 轨迹成就是不追溯的 Session 行为，不做历史回填。

## 📦 安装

前置：DSH（`dsh web` 可运行）、Node ≥ 22.19、pnpm。

```bash
# GitHub 安装（预构建 lib/ 已提交，无需 allowBuilds）
dsh plugin --profile web add "github:luumod/dsh-achievements#main"

# 本地目录安装
cd dsh-achievements && npm install --legacy-peer-deps && npm run build
dsh plugin --profile web add ./dsh-achievements
```

安装后**重启 `dsh web`**，然后正常使用——完成第一个回合即解锁第一个成就。

## 🎮 使用

1. 重启后正常对话、让 agent 干活：
   - 回合完成、工具调用、新会话、每日活跃都会累计；
   - 解锁新成就时右下角弹出 toast；
2. **设置 → 🏆 成就**：七个长期计数（回合/工具调用/会话/活跃天数/读取次数/修改次数/测试）加独立的连续天数行；徽章墙按七条成长路线与特殊链折叠，路线 header 直接显示进度，并支持按“全部 / 未解锁 / 已解锁”筛选。特殊行为分“其它 / 经典行为、连续作战、行为狂人、会话马拉松、单轮深潜、工具齐射、时间异象”分组，已解锁带时间戳、未解锁置灰，隐藏成就未解锁时仅显示 `???`。

## 🔌 开发者：`ctx.achievements` SDK

从宿主插件注册自定义成就（内置与第三方走同一条求值路径）：

```ts
export const inject = ['achievements']

export function apply(ctx: Context): void {
  ctx.achievements.register({
    id: 'python-first-run',
    icon: '🐍',
    title: { zh: '蟒蛇出洞', en: 'First Python Run' },
    description: { zh: '首次运行 Python', en: 'Run Python for the first time' },
    rarity: 'uncommon',
    xp: 20,
    scope: 'session',
    evaluate: ctx => ({ unlocked: ctx.session.toolCalls >= 1 }),
  })
}
```

也可注册整个 Pack：`ctx.achievements.registerPack({ id, version, name, achievements })`。重复 id 会抛异常。完整指南见 `docs/SDK.md`，示例见 `examples/python-pack.ts`。

浏览器侧，其它客户端插件通过 `ctx.achievementsState.refresh()` / `ctx.achievementsState.unlockedIds()` 读取状态。

## 🛠️ 本地开发

```bash
npm install --legacy-peer-deps
$env:DSH_NODE_MODULES = "$env:USERPROFILE\.dsh\profiles\node_modules"
npm run setup:dsh-workspace
npm run verify                          # ★ 一键门禁：clean + typecheck + test + build
npm test                                # vitest（引擎解锁规则/连击/幂等 + manifest 契约）
```

## 目录结构

```
dsh-achievements/
├── package.json            # dsh.bundle.patch + dsh.client 双契约
├── cordis.patch.yml        # bundle 补丁层
├── tsdown.config.ts        # client bundle（__ModuleLoader__.load + 纯度门禁）
├── scripts/                # build / clean / setup-dsh-workspace / verify
├── src/
│   ├── achievements.ts     # ★ 纯成就引擎（applyEvent / BUILTIN_ACHIEVEMENTS，可单测）
│   ├── state.ts            # 状态持久化（DSH 主目录 JSON）
│   ├── index.ts            # 宿主半：事件钩子 + HTTP API + 设置
│   └── client/             # 浏览器半
│       ├── index.ts        # apply：ctx.achievements 服务 + 轮询 + 槽位注入
│       ├── achievements-client.ts  # 状态 API 客户端
│       ├── badge-panel.tsx # 徽章墙（settings.section）
│       └── toast.ts        # 解锁 toast（零依赖 DOM）
└── tests/                  # 引擎 + manifest
```

## 🧩 生态定位

- 填补空白：DSH 生态此前**无统一成就/徽章系统**（仅 `dsh-daily-progress` 有连胜/完成率），社区调研明确点名"暂无真正游戏化任务/成就/等级系统"。
- 技术路线：宿主走官方事件缝（`session/event` + `tools/result`）驱动纯引擎；浏览器半走 client 插件（`settings.section` + 轮询状态 API），与 `dsh-soundscape` 同一套双面包范式。
- 零核心改动：只读事件 + 自有状态文件 + `ctx.effect` 注册。

## ⚖️ License

MIT © 2026 Blaczz（上游）。本仓库是 [Blaczz/dsh-achievements](https://github.com/Blaczz/dsh-achievements) 的 fork，在其基础上新增行为成就、`ctx.achievements` SDK 与分享层；若上游 PR 合并，本 fork 将归档并让位于原仓库。独立社区插件，与 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 无关。
