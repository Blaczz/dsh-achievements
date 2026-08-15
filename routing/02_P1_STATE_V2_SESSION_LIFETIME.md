# Task 02 — P1 State v2：Lifetime/Profile + Session

| 字段 | 内容 |
|---|---|
| 优先级 | **P1 / 核心架构** |
| 阶段 | Behavior Achievements 基础 |
| 前置依赖 | Task 01 |
| 核心目标 | 让引擎可以识别单 session 行为，同时保留跨 session 的 profile/lifetime 状态 |
| 风险 | 中高 |
| 完成后解锁 | Déjà Vu、Rabbit Hole、YOLO、One Shot、测试失败→成功等行为识别 |

## 建议状态结构

`AchievementState`：

- `version: 2`
- `profile`
- `sessions: Record<sessionId, SessionAchievementState>`

Profile/Lifetime 至少包含：

- `xp`
- `unlocked`
- `turns`
- `toolCalls`
- `sessions`
- `currentStreak`
- `longestStreak`

Session 至少包含：

- `toolCalls`
- `toolsByName`
- `filesRead`
- `filesEdited`
- `commands`
- `tests.runs`
- `tests.passed`
- `tests.failed`
- `firstEditSeq?`
- `firstTestSeq?`
- `consecutiveReads`
- `editsBeforeFirstTest`

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 定义 State v2 | 类型定义 | profile 与 sessions 明确分层 |
| 2 | 定义 SessionAchievementState | 类型定义 | 能表达规划中的首批行为成就 |
| 3 | 增加 `version: 2` | schema 版本 | 持久化数据可识别版本 |
| 4 | 实现 `migrateState(oldState)` | migration | v1 counter state 可无损迁移到 v2 |
| 5 | 处理 session 创建/复用 | reducer/state helper | 同 session 事件写入同一 SessionState |
| 6 | 确定 session 清理策略 | 明确策略 | 不影响当前活跃 session；避免无限增长 |
| 7 | 增加持久化回归测试 | 测试 | reload 后 profile/unlocks/lifetime 正确恢复 |
| 8 | 增加 migration 测试 | 测试 | 旧 JSON 输入可产生合法 v2 state |

## Definition of Done

- [ ] State schema 明确为 v2
- [ ] v1 → v2 migration 可测试
- [ ] Lifetime 与 Session 互不混淆
- [ ] 同一 session 的文件/命令/测试状态可累计
- [ ] 跨 session 不会把行为状态串起来
- [ ] 现有跨 session persistence 仍工作

## 不在本任务内

- 暂不迁移到数据库
- 暂不保存详细历史事件流
- 暂不做 daily quests / XP history
