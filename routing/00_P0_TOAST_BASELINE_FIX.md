# Task 00 — P0 Toast 历史成就重弹修复

| 字段 | 内容 |
|---|---|
| 优先级 | **P0 / 立即处理** |
| 阶段 | 稳定性修复 |
| 前置依赖 | 无 |
| 核心目标 | 浏览器端第一次拿到 snapshot 时只建立 baseline，不把历史已解锁成就当作 fresh unlock |
| 影响范围 | Browser Client / Toast unlock detection |
| 风险 | 低 |
| 完成后解锁 | 后续所有成就扩展都不会放大“重载后连环 Toast”问题 |

## 执行任务表

| # | 任务 | 输出 | 验收标准 |
|---|---|---|---|
| 1 | 定位当前 `lastUnlocked = new Set<string>()` 与 fresh diff 逻辑 | 当前实现位置记录 | 明确首次 refresh 为什么会把所有 unlocked 判定为 fresh |
| 2 | 增加 `initialized`/baseline 语义 | 首帧 baseline 逻辑 | 第一次 snapshot 只同步 `lastUnlocked`，不触发 Toast |
| 3 | 保留后续 diff 行为 | fresh unlock diff | baseline 建立后新增成就仍进入 Toast 队列 |
| 4 | 增加回归测试 | 测试用例 | 覆盖“已有 30 个 unlocked → reload → 0 个 Toast” |
| 5 | 增加新解锁测试 | 测试用例 | reload 后再新增 1 个 achievement，只弹 1 个 |
| 6 | 手动验证 focus / visibility / 轮询 refresh | 验证记录 | 任意 refresh 都不会把历史成就重新加入队列 |

## Definition of Done

- [ ] 初次加载不会显示历史 unlock Toast
- [ ] 新 unlock 仍正常显示
- [ ] 多次 refresh/focus/visibility change 不会重复显示
- [ ] 回归测试已加入现有 Vitest 测试体系
- [ ] 不改变现有 Badge Wall 的已解锁状态展示

## 不在本任务内

- 不做实时推送
- 不重做 Toast 样式
- 不引入 rarity / XP
