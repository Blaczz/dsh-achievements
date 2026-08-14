# dsh-achievements 🏆

> DeepSeek Harness 成就/游戏化插件：跨会话的成就徽章系统——自动累计回合、工具调用、会话数与连续天数，解锁时弹 toast，设置页有完整徽章墙，并提供 `ctx.achievements` 服务。零核心改动。

[English](./README.md) | 简体中文

**DeepSeek Harness（DSH）** 的游戏化插件：它默默统计你的真实使用（回合、工具调用、会话、连续天数），达到里程碑即解锁成就，实时弹 toast 庆祝，在设置页展示徽章墙。状态跨会话持久化（存在 DSH 主目录），所有统计走官方事件扩展缝（`session/event` 的 `turn/end` + `tools/result`），**不改动任何核心代码**。

## ✨ 内置成就

| 成就 | 条件 |
|---|---|
| 🎬 初次登场 | 完成第一个回合 |
| 🔟 渐入佳境 | 累计 10 回合 |
| 💯 百炼成钢 | 累计 100 回合 |
| 🔧 工具初体验 | 首次工具调用 |
| 🛠️ 工具大师 | 累计 100 次工具调用 |
| 📚 会话收藏家 | 累计 10 个会话 |
| 🔥 三日之约 | 连续 3 天使用 |
| 🌋 七日火山 | 连续 7 天使用 |

## 📦 安装

前置：DSH（`dsh web` 可运行）、Node ≥ 22.19、pnpm。

```bash
# GitHub 安装（预构建 lib/ 已提交，无需 allowBuilds）
dsh plugin --profile web add "github:Blaczz/dsh-achievements#main"

# 本地目录安装
cd dsh-achievements && npm install --legacy-peer-deps && npm run build
dsh plugin --profile web add ./dsh-achievements
```

安装后**重启 `dsh web`**，然后正常使用——完成第一个回合即解锁第一个成就。

## 🎮 使用

1. 重启后正常对话、让 agent 干活：
   - 回合完成、工具调用、新会话、每日活跃都会累计；
   - 解锁新成就时右下角弹出 toast；
2. **设置 → 🏆 成就**：查看四个计数器（回合/工具/会话/连续天数）与徽章墙（已解锁带时间戳，未解锁置灰）。

## 🔌 开发者：`ctx.achievements` 服务

```ts
export const inject = ['slots', 'achievements']

export function apply(ctx: Context): void {
  void ctx.achievements.refresh()           // 重新拉取状态
  const ids = ctx.achievements.unlockedIds() // 已解锁成就 id 列表
}
```

> 扩展点：`dsh-achievements` 也导出纯引擎（`applyEvent` / `BUILTIN_ACHIEVEMENTS` / `AchievementDef`），未来可在服务端注册自定义成就。

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

MIT © 2026 Blaczz。独立社区插件，与 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 无关。
