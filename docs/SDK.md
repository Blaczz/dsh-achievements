# Achievement SDK：给 dsh-achievements 贡献成就

本文档面向想在**宿主（Host）插件**里注册自定义成就的第三方作者。P4 起，内置成就与第三方成就走同一条注册/求值路径——你不再需要改 `BUILTIN_ACHIEVEMENTS`。

## 核心概念

- **AchievementDef**：一个成就定义，含 `id / icon / title / description / flavorText / rarity / xp / scope / hidden / evaluate(ctx)`。
- **AchievementPack**：一组成就的命名集合（`id / version / name / achievements`）。
- **`ctx.achievements`**：宿主的 SDK 服务，提供 `register(def)` 与 `registerPack(pack)`。

## 生命周期

在你的 Host 插件 `apply(ctx)` 里调用 `ctx.achievements.register(...)`（或 `registerPack(...)`）。注册即时生效：之后每一个 `session/event`（回合结束、工具结果）都会对所有已注册成就求值。**不需要**显式刷新。

```ts
import type { Context } from '@deepseek-ai/cordis'

export const inject = ['achievements']

export function apply(ctx: Context): void {
  ctx.achievements.register({ /* AchievementDef */ })
}
```

## 注册单个成就

```ts
ctx.achievements.register({
  id: 'python-first-run',
  icon: '🐍',
  title: { zh: '蟒蛇出洞', en: 'First Python Run' },
  description: { zh: '首次运行 Python', en: 'Run Python for the first time' },
  flavorText: { zh: 'import this', en: 'import this' },
  rarity: 'uncommon',
  xp: 20,
  scope: 'session',
  evaluate: ctx => ({ unlocked: ctx.session.toolCalls >= 1 }),
})
```

`evaluate(ctx)` 收到一个只读上下文：

```ts
interface AchievementContext {
  profile: ProfileState              // 跨会话 lifetime 数据
  session: SessionAchievementState   // 当前会话数据
}
```

返回 `{ unlocked, progress?, target? }`；`progress/target` 会显示在徽章墙的进度条上。

## 注册一个 Pack

```ts
import type { AchievementPack } from '@deepseek-ai/dsh-achievements'

export const PYTHON_PACK: AchievementPack = {
  id: 'python',
  version: '0.1.0',
  name: { zh: 'Python', en: 'Python' },
  achievements: [
    { id: 'python-first-run', /* ... */ evaluate: ctx => ({ unlocked: false }) },
    { id: 'python-explorer', /* ... */ evaluate: ctx => ({ unlocked: false }) },
  ],
}

// 在 apply 里：
ctx.achievements.registerPack(PYTHON_PACK)
```

完整可运行示例见 [`../examples/python-pack.ts`](../examples/python-pack.ts)。

## 可用上下文字段

`ctx.session` 常见字段：

| 字段 | 含义 |
|---|---|
| `toolCalls` | 本会话工具调用总数 |
| `toolsByName` | 工具名 → 调用次数 |
| `filesRead` / `filesEdited` | 文件路径 → 读写次数 |
| `commands` | 命令 → 执行次数 |
| `tests` | `{ runs, passed, failed, lastOutcome }` |
| `readsBeforeFirstEdit` / `editsBeforeFirstTest` | 首个 edit/test 前的去重文件数 |
| `failingStreak` / `failingCommand` | 同命令连续失败 |

`ctx.profile` 常见字段：`turns / toolCalls / sessions / currentStreak / longestStreak / unlocked / xp / toolsByName`。

## ID 冲突

`id` 必须全局唯一。重复注册**抛出异常**（fail-fast）：

```
[achievements] duplicate achievement id: "python-first-run"
```

内置成就使用 `builtin` pack（`first-turn`、`deja-vu` 等 14 个 id），避免与它们重名。

## 测试方式

纯引擎 + 注册器都可以在 vitest 里直接测，无需跑 DSH：

```ts
import { createAchievementRegistry, applyEvent, createInitialState } from '@deepseek-ai/dsh-achievements'

it('my achievement unlocks', () => {
  const registry = createAchievementRegistry()
  registry.register({ id: 'x', /* ... */ evaluate: ctx => ({ unlocked: ctx.session.toolCalls >= 2 }) })
  let state = createInitialState()
  state = applyEvent(state, toolCall('s', 0), registry.list(), '2026-01-01').state
  const result = applyEvent(state, toolCall('s', 1), registry.list(), '2026-01-01')
  expect(result.newlyUnlocked.map(d => d.id)).toContain('x')
})
```

参考本仓库 `tests/sdk.spec.ts`。
