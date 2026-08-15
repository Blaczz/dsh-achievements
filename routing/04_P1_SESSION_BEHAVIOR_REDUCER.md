# Task 04 — P1 Session Behavior Reducer / State Update

| 字段 | 内容 |
|---|---|
| 优先级 | **P1 / 核心实现** |
| 阶段 | Behavior Achievements 基础 |
| 前置依赖 | Task 02、Task 03 |
| 核心目标 | 把标准化 AchievementEvent 稳定地归约到 Profile/Lifetime + SessionState |
| 风险 | 中 |
| 完成后解锁 | 所有首批行为成就可以只读 Context，不处理事件细节 |

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 设计纯函数 state transition | reducer/helper | `(state, event) -> nextState` 可单测 |
| 2 | 更新通用 toolCalls/toolsByName | 状态更新 | tool-call 计数正确且幂等策略明确 |
| 3 | 更新 filesRead | 状态更新 | path 计数与 unique file 统计可导出 |
| 4 | 更新 filesEdited | 状态更新 | 同一文件重复修改次数可识别 |
| 5 | 更新 commands | 状态更新 | 相同命令重复执行次数可识别 |
| 6 | 更新 tests | 状态更新 | runs/passed/failed 正确 |
| 7 | 记录 firstEditSeq / firstTestSeq | 顺序状态 | 可判断“edit 前读了多少”“test 前改了多少” |
| 8 | 更新 editsBeforeFirstTest | 状态更新 | YOLO 可直接评估 |
| 9 | 处理重复事件/幂等 | 规则 | 不因重复 Host event 双计数 |
| 10 | 建立 Context builder | `AchievementContext` | evaluate 层只读干净状态 |

## Definition of Done

- [ ] Reducer 是可独立测试的纯逻辑
- [ ] Session 统计与 Lifetime 统计同时正确
- [ ] 重复事件不会造成明显双计数
- [ ] 规则层无需知道 tool payload
- [ ] 关键行为顺序可通过 seq 表达
- [ ] 所有字段都有最小单测覆盖
