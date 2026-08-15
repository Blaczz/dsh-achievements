# Task 10 — P4 Achievement SDK + Packs

| 字段 | 内容 |
|---|---|
| 优先级 | **P4** |
| 阶段 | v0.5 Achievement SDK |
| 前置依赖 | Task 01–09 |
| 核心目标 | 从硬编码 `BUILTIN_ACHIEVEMENTS` 升级为可注册的 Agent Achievement Framework |
| 风险 | 高（API 稳定性） |
| 产品意义 | 让 Python/Rust/Git/Testing 等 Pack 由外部模块贡献 |

## 目标能力

至少提供类似：

`ctx.achievements.register({...})`

而不是仅：

- `refresh()`
- `unlockedIds()`

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 定义公开 `registerAchievement()` API | SDK 接口 | 外部模块可注册 Definition |
| 2 | 定义 ID 冲突策略 | 错误语义 | 重复 ID 行为明确 |
| 3 | 定义生命周期 | 文档 | 何时注册、何时 evaluate 明确 |
| 4 | 定义 Pack metadata | Pack schema | Pack 名称/版本/成就列表可描述 |
| 5 | 把 Builtin 改为默认 Pack | 内部重构 | 内建成就使用同一注册机制 |
| 6 | 创建最小 Example Pack | 示例 | 可独立注册 1–2 个成就 |
| 7 | 加 SDK 测试 | 测试 | 注册、重复 ID、scope、unlock 均正确 |
| 8 | 写作者文档 | 文档 | 第三方可按文档实现 Pack |

## Definition of Done

- [ ] Builtin 与第三方 Achievement 走同一核心路径
- [ ] 外部代码无需修改核心数组即可注册
- [ ] API 冲突/错误处理明确
- [ ] 至少有一个可运行 Example Pack
- [ ] SDK 文档包含最小示例与测试方式
