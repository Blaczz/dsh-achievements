# Agent Achievements 阶段性实施总计划

> 目标：在保留现有 Achievement MVP（Host/Browser 分离、纯函数引擎、JSON 持久化、Badge Wall、Toast、Vitest 测试）的前提下，把产品从“累计里程碑系统”升级为“Agent 行为成就系统”。

## 优先级结论

当前最迫切的不是立刻堆更多成就，而是按下面的顺序推进：

1. **P0：修复 Toast 重载后把历史成就全部重新弹出的基线问题。**
   - 这是已知的直接 UX 缺陷。
   - 改动小、风险低，且应在继续扩展功能前完成。
2. **P1：完成行为成就的架构底座。**
   - Achievement 从 `condition(counters)` 升级为 `evaluate(ctx)`。
   - State 拆成 Lifetime/Profile + Session。
   - 增加 Event Classifier，把 Harness 原始事件标准化。
3. **P1：实现第一批 6 个核心行为成就。**
   - Déjà Vu
   - Rabbit Hole
   - YOLO
   - It Works Eventually
   - Surely This Time
   - Touch Grass
4. **P1：补齐行为引擎测试和回归测试。**
5. **P1.5：实现实时 Unlock 推送。**
   - 让“测试刚通过 → 立刻弹成就”成为核心体验。
6. **P2：Steamification。**
   - rarity / XP / level / progress / flavorText / hidden achievement / Toast 视觉升级。
7. **P3：Agent Profile + Session End 战报。**
8. **P4：Achievement SDK + Achievement Packs。**
9. **P5：分享卡片 / Agent Wrapped / Community Gamification Layer。**

## 为什么这样排序

行为成就是产品差异化的核心，但它依赖更丰富的事件和 Session 状态；因此不能先堆规则，必须先把 Domain Model、State 和 Event Classifier 打稳。

Toast 的“刷新后历史成就重弹”是一个独立且明确的缺陷，修复成本很低，所以放在所有扩展之前。

实时推送非常重要，但可以在行为成就 MVP 能正确识别并解锁之后接入，这样能减少调试维度。

## 阶段 Gate

| 阶段 | Gate | 通过条件 |
|---|---|---|
| P0 稳定性 | Toast 基线修复 | 重载浏览器插件不会重弹历史成就；新解锁仍正常弹出 |
| P1 架构 | 行为识别底座 | 事件可标准化；Session/Lifetime 可独立更新；旧状态可迁移 |
| P1 MVP | 6 个行为成就 | 每个成就都有确定性单测；跨 session 不串状态 |
| P1.5 实时性 | 实时 Unlock | 解锁无需等待轮询/focus/visibility refresh |
| P2 游戏化 | Steamification | rarity/XP/progress/hidden/flavorText 可完整渲染 |
| P3 可观察性 | Profile/战报 | 可从已有规则数据生成 Profile 与 Session Summary |
| P4 可扩展性 | SDK | 外部模块可以注册成就，而非只能改 BUILTIN_ACHIEVEMENTS |
| P5 传播性 | 分享/社区 | 在不引入账户/排行榜等重平台工程前提下完成可分享体验 |

## 暂不纳入当前主线

以下内容先明确冻结，避免项目过早平台化：

- 排行榜
- 在线账户
- 云同步
- 好友系统
- 赛季
- 每日随机任务
- LLM 自动生成 Achievement

## 文件执行顺序

按编号顺序执行即可。每个任务文件都是独立的“完成任务表”，其中包含目标、依赖、步骤、验收标准与 Definition of Done。
