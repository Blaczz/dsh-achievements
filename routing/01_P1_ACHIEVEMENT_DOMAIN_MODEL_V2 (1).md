# Task 01 — P1 Achievement Domain Model v2

| 字段 | 内容 |
|---|---|
| 优先级 | **P1 / 核心架构** |
| 阶段 | Behavior Achievements 基础 |
| 前置依赖 | Task 00 建议先完成 |
| 核心目标 | 把 Achievement 从 Counter Rule 升级成 Context Rule |
| 风险 | 中 |
| 完成后解锁 | Progress、Rarity、XP、Session Scope、Hidden、Behavior Pattern |

## 目标模型

核心方向：

- `condition(counters) -> boolean`
- 升级为 `evaluate(ctx) -> AchievementEvaluation`

Achievement Definition 至少支持：

- `id`
- `icon`
- `title`
- `description`
- `flavorText?`
- `rarity`
- `xp`
- `scope`
- `hidden?`
- `evaluate(ctx)`

Evaluation 至少支持：

- `unlocked`
- `progress?`
- `target?`

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 定义 `AchievementRarity` | 类型定义 | 至少支持 common/uncommon/rare/epic/legendary |
| 2 | 定义 `AchievementScope` | 类型定义 | 至少支持 lifetime/session |
| 3 | 定义 `AchievementEvaluation` | 类型定义 | 支持 unlocked/progress/target |
| 4 | 升级 `AchievementDef` | 新接口 | 使用 `evaluate(ctx)`，保留本地化 title/description |
| 5 | 定义 `AchievementContext` 最小接口 | Context 类型 | 可同时读取 profile/lifetime/session |
| 6 | 为旧 counter achievements 写兼容适配 | 兼容层 | 现有累计成就仍能工作 |
| 7 | 更新相关测试 | 单测 | 旧成就行为不回归，新接口可被纯函数测试 |

## Definition of Done

- [ ] 引擎不再要求每个成就只接收 counters
- [ ] 一个成就可以声明 session/lifetime scope
- [ ] Evaluation 可以返回 progress/target
- [ ] 旧 8 个累计成就无需推倒重写即可继续运行
- [ ] TypeScript 类型检查通过
- [ ] Vitest 通过

## 不在本任务内

- 不实现完整 SessionState
- 不实现具体行为成就
- 不改 UI 视觉
