# Task 03 — P1 Event Classifier：Harness Event → AchievementEvent

| 字段 | 内容 |
|---|---|
| 优先级 | **P1 / 核心架构** |
| 阶段 | Behavior Achievements 基础 |
| 前置依赖 | Task 01、Task 02 |
| 核心目标 | 隔离 Harness 原始 payload 与 Achievement 规则 |
| 风险 | 高（依赖宿主真实事件结构） |
| 完成后解锁 | 文件读写、Shell、测试结果、Tool Result 等统一行为识别 |

## 设计原则

Achievement 规则不能直接解析 Harness 的 tool payload。

固定分层：

`Harness Event → Event Classifier → AchievementEvent → Achievement Engine`

建议标准化事件：

- `turn-end`
- `tool-call`
- `tool-result`
- `file-read`
- `file-edit`
- `shell-command`
- `test-result`

所有 session 内事件尽量包含：

- `sessionId`
- `seq`

Call/Result 关联事件尽量包含：

- `callId`

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 盘点当前 Host 可获得的原始事件 | 事件清单 | 确认 `session/event -> turn/end`、`tools/result` 等真实 payload |
| 2 | 定义标准化 `AchievementEvent` union | 类型定义 | 规则层不引用 Harness 原始结构 |
| 3 | 设计 `ToolSummary` 最小字段 | 类型定义 | 只保留行为识别需要的信息 |
| 4 | 实现 file-read classifier | 分类逻辑 | 可稳定识别文件读取与 path |
| 5 | 实现 file-edit classifier | 分类逻辑 | 可稳定识别文件修改与 path |
| 6 | 实现 shell-command classifier | 分类逻辑 | 可提取 command |
| 7 | 实现 test-result classifier | 分类逻辑 | 可识别 passed/failed 与 command |
| 8 | 处理无法分类事件 | fallback 行为 | 不崩溃、不误记；保留通用 tool-call |
| 9 | 为每类 classifier 增加 fixture 测试 | 测试 | 原始 payload → 标准事件结果稳定 |

## Definition of Done

- [ ] Achievement Engine 不直接依赖 Harness tool payload
- [ ] 每种标准事件都有单测
- [ ] 无法识别的工具仍可安全计为普通 tool-call
- [ ] `seq` 在单 session 内可用于行为先后判断
- [ ] test result 的 pass/fail 判定有明确、可测试规则

## 风险控制

本任务是首个真正依赖宿主事件细节的部分。若某些工具的 payload 不稳定，应优先保证“不会误判”，再逐步补充 classifier。
