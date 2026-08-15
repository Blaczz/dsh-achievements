# Task 07 — P1.5 实时 Unlock 推送

| 字段 | 内容 |
|---|---|
| 优先级 | **P1.5 / 高体验价值** |
| 阶段 | v0.2.x / v0.3 前置体验优化 |
| 前置依赖 | Task 00、Task 05、Task 06 |
| 核心目标 | 从“轮询后才知道解锁”升级为“行为发生后立即反馈” |
| 风险 | 中高（取决于 Host ↔ Browser 可用通信机制） |
| 产品意义 | 形成“pytest → PASS → 立刻 Achievement Unlocked”的核心爽点 |

## 当前要替换的体验

当前 refresh 来源包括：

- mount
- focus
- visibility change
- 每 30 秒轮询

目标是：**unlock 产生时主动通知 Browser Client**，轮询保留为容错而不是主路径。

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 盘点 Host→Browser 可用消息机制 | 技术方案 | 选择与现有 DSH 插件能力最匹配方案 |
| 2 | 定义 unlock event payload | 消息结构 | 至少包含 achievement id 与必要展示数据/刷新信号 |
| 3 | Host 在 unlock 后发出通知 | 主动推送 | unlock 与持久化顺序明确 |
| 4 | Browser 接收 unlock 通知 | 客户端处理 | 收到后刷新 snapshot/直接入 Toast 队列 |
| 5 | 保留 refresh fallback | 容错 | 丢消息后仍能最终恢复状态 |
| 6 | 防重复 | 去重 | 推送 + fallback 不产生双 Toast |
| 7 | 集成测试/手测 | 验证记录 | 行为触发后无需等待 30 秒/focus |

## Definition of Done

- [ ] 新 unlock 不依赖轮询才出现
- [ ] refresh 仍可恢复最终一致状态
- [ ] 推送与 refresh 同时发生不会重复 Toast
- [ ] reload baseline 修复仍有效
- [ ] 无法推送时不会影响 achievement 状态正确性
