# Task 11 — P5 分享与 Community Gamification Layer

| 字段 | 内容 |
|---|---|
| 优先级 | **P5 / 长期** |
| 阶段 | v1.0 |
| 前置依赖 | Task 08–10 |
| 核心目标 | 提升传播与长期玩法，但保持轻量，不进入账户/排行榜平台工程 |
| 风险 | 中高 |
| 产品意义 | 形成可分享的 Achievement Card、Agent Wrapped 与 Pack 生态 |

## 建议先做的 v1.0 范围

- Shareable Achievement Card
- Agent Wrapped
- Achievement Chains / Saga
- Pack 浏览与组合（本地/插件层）
- Profile export / share

## 暂不做

- 在线账户
- 排行榜
- 好友
- 云同步
- 赛季
- 每日随机任务
- LLM 自动生成 Achievement

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 定义 Achievement Card 数据结构 | ViewModel | 可由 unlock/profile 生成 |
| 2 | 定义分享导出方案 | export | 不依赖在线账户即可生成分享内容 |
| 3 | 实现 Achievement Chains | 规则/UI | 可表达 Search Party → Grep Enjoyer → ... |
| 4 | 实现 Agent Wrapped 数据聚合 | summary | 可基于已有 profile/session 数据生成 |
| 5 | 设计 Pack 发现/展示体验 | UI/metadata | 不强制引入远端平台 |
| 6 | 增加 privacy boundary | 文档/逻辑 | 默认不上传代码、命令、路径等敏感数据 |
| 7 | 发布前体验测试 | 验证 | 分享内容可理解、有传播性、无明显隐私泄露 |

## Definition of Done

- [ ] 用户可生成可分享成就卡
- [ ] Agent Wrapped 不需要云账户即可使用
- [ ] Achievement Chain 可展示进度
- [ ] 默认分享内容不暴露项目敏感路径/命令
- [ ] 未引入排行榜/账户/赛季等非必要平台复杂度
