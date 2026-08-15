# Task 05 — P1 第一批 Behavior Achievements MVP

| 字段 | 内容 |
|---|---|
| 优先级 | **P1 / 产品核心** |
| 阶段 | v0.2 Funny Achievements |
| 前置依赖 | Task 01–04 |
| 核心目标 | 用 6 个高辨识度行为成就证明“Agent 行为成就系统”成立 |
| 风险 | 中 |
| 发布意义 | 这是第一个与原版“累计数字成就墙”产生明显产品差异的版本 |

## 第一批建议固定为 6 个

| 成就 | 触发条件 | Scope | 难度 |
|---|---|---|---|
| 🔁 Déjà Vu | 同一文件修改 5 次 | session | ★ |
| 🕳 Rabbit Hole | 第一次 edit 前读取 ≥20 个文件 | session | ★ |
| 💣 YOLO | 第一次 test 前修改 ≥8 个文件 | session | ★★ |
| 🔥 It Works Eventually | 测试失败 ≥5 次后成功 | session | ★★ |
| 🎰 Surely This Time | 相同测试命令连续失败 ≥5 次 | session | ★★ |
| 🌱 Touch Grass | 单 session 工具调用 ≥100 次 | session | ★ |

> 第二批再补 One Shot、Librarian、Dependency Archaeologist、Gigachad。

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 为每个 achievement 写 Definition | 6 个 `AchievementDef` | title/description/flavorText/rarity/xp/scope 完整 |
| 2 | 实现 Déjà Vu evaluate | 规则 | max(filesEdited) ≥ 5 |
| 3 | 实现 Rabbit Hole evaluate | 规则 | first edit 前 read 计数满足阈值 |
| 4 | 实现 YOLO evaluate | 规则 | first test 前 edit 文件数满足阈值 |
| 5 | 实现 It Works Eventually | 规则 | failed tests ≥5 后出现 pass |
| 6 | 实现 Surely This Time | 规则 | 同命令连续失败 ≥5 |
| 7 | 实现 Touch Grass | 规则 | session.toolCalls ≥100 |
| 8 | 将 unlock 接入现有持久化 | 状态 | 解锁一次后跨 refresh 保留 |
| 9 | 接入现有 Badge Wall | UI 数据 | 新成就可以展示锁定/解锁状态 |
| 10 | 接入现有 Toast 队列 | UI 数据 | 新 unlock 可进入现有 Toast 流程 |

## Definition of Done

- [ ] 6 个成就都能被真实事件触发
- [ ] 每个成就都有 threshold 前/后单测
- [ ] session scope 不跨 session 污染
- [ ] 已解锁成就保持幂等
- [ ] Badge Wall 能显示
- [ ] Toast 能显示
- [ ] 不依赖 LLM 进行判断

## Release Gate

完成本任务后即可形成 **v0.2 Behavior Achievements Update** 的最小可发布版本。
