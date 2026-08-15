# Task 09 — P3 Agent Profile + Session End 战报

| 字段 | 内容 |
|---|---|
| 优先级 | **P3** |
| 阶段 | v0.4 Agent Profile |
| 前置依赖 | Task 08 |
| 核心目标 | 把成就数据进一步转化为轻量 observability 与“Agent Persona” |
| 风险 | 中 |
| 产品意义 | 从“成就墙”升级为“Agent 身份与行为总结” |

## 范围

### Agent Profile

建议至少展示：

- LEVEL
- XP progress
- 已解锁 Achievement 数
- rarity 分布
- Favorite Tool
- Current Title / Agent Persona

### Persona 先用纯规则

例如：

- 大量 read/search、少量 edit → Detective
- 大量 edit、测试较晚 → Cowboy
- 测试频繁、修改谨慎 → Test-Driven
- 大量重复修改 → Perfectionist

### Session End 战报

至少展示：

- Tool calls
- Files read
- Files edited
- Tests
- Failures
- 本 session 解锁成就
- XP gained
- Level up（如有）

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 定义 Profile ViewModel | 数据模型 | UI 不直接拼接 raw state |
| 2 | 实现 Favorite Tool | 派生逻辑 | 可从 toolsByName/lifetime 数据得到 |
| 3 | 实现 Persona rules | 纯规则 | 同一状态得到确定 title |
| 4 | 实现 rarity summary | 派生逻辑 | Common/Rare 等统计正确 |
| 5 | 定义 Session Summary | 数据模型 | 可计算本 session 统计 |
| 6 | 记录本 session unlock/XP delta | 状态/派生 | 战报只显示本 session 新增 |
| 7 | 实现 Session End UI | UI | 信息层级清晰 |
| 8 | 增加 persona/summary 单测 | 测试 | 纯规则可回归 |

## Definition of Done

- [ ] Profile 可以完整展示 Agent 状态
- [ ] Persona 不依赖 LLM
- [ ] Session End 战报只统计当前 session
- [ ] Session 新增 XP 与 unlock 可准确计算
- [ ] UI 能表达 Level Up
