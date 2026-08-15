# Task 08 — P2 Steamification：Rarity / XP / Progress / Hidden / Toast

| 字段 | 内容 |
|---|---|
| 优先级 | **P2** |
| 阶段 | v0.3 Steamification |
| 前置依赖 | Task 01–07 |
| 核心目标 | 把“规则系统”包装成真正有游戏感的成就系统 |
| 风险 | 中 |
| 产品意义 | 强化截图传播、解锁反馈与持续收集动机 |

## 范围

本阶段实现：

- rarity
- XP
- level
- progress / target
- flavorText
- hidden achievements
- Steam-like Toast

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 定义 rarity 展示映射 | UI model | common→legendary 可渲染 |
| 2 | 实现 XP 累计 | profile logic | achievement 只发放一次 XP |
| 3 | 定义 level 公式 | level helper | 同一 XP 得到确定 level/progress |
| 4 | Badge Wall 支持 progress | UI | 可显示 17/20 与进度条 |
| 5 | 支持 flavorText | UI | 解锁详情/Toast 可展示 |
| 6 | 支持 hidden achievement | UI | 未解锁显示 ???，解锁后恢复真实内容 |
| 7 | 升级 Toast 信息层级 | UI | rarity/title/description/+XP 清晰 |
| 8 | 不同 rarity 的视觉差异 | UI | 差异可辨识但不影响可读性 |
| 9 | 增加 hidden/progress/XP 测试 | 测试 | 数据与 UI model 正确 |

## Definition of Done

- [ ] XP 不重复发放
- [ ] Level 计算稳定
- [ ] Progress 成就可展示 progress/target
- [ ] Hidden 未解锁时不泄漏真实 title/description
- [ ] Toast 能展示 rarity 与 +XP
- [ ] Common 到 Legendary 有一致的视觉层级
