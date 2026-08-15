# Task 06 — P1 行为引擎测试矩阵与回归保护

| 字段 | 内容 |
|---|---|
| 优先级 | **P1 / 发布阻塞** |
| 阶段 | v0.2 稳定性 |
| 前置依赖 | Task 01–05 |
| 核心目标 | 延续现有纯函数 Vitest 风格，把行为成就变成确定性、可回归的规则系统 |
| 风险 | 低 |
| 完成后解锁 | 安全重构、后续大量 Achievement 扩展 |

## 执行任务表

| # | 测试维度 | 必须覆盖 |
|---|---|---|
| 1 | Threshold | N-1 不解锁；N 解锁；N+1 保持解锁 |
| 2 | Session Isolation | A session 的行为不影响 B session |
| 3 | Persistence | unlock/profile reload 后恢复 |
| 4 | Migration | v1 state → v2 state |
| 5 | Idempotency | 同 achievement 不重复发放 XP/重复 unlock |
| 6 | Event Ordering | firstEditSeq / firstTestSeq 正确影响规则 |
| 7 | Duplicate Events | 重复 Host event 不造成双计数 |
| 8 | Classifier Fixtures | 常见 tool payload → 标准事件 |
| 9 | Unknown Tool | 未识别工具安全 fallback |
| 10 | Toast Baseline | reload 不重弹历史成就 |

## 每个首批成就的最小测试

| 成就 | Negative | Positive | Edge |
|---|---|---|---|
| Déjà Vu | 同文件 4 次 | 同文件 5 次 | 不同文件总计 5 次不应误判 |
| Rabbit Hole | edit 前 19 次 read | ≥20 次 read 后首次 edit | edit 后再读不应倒算 |
| YOLO | test 前 7 个 edit | ≥8 个 edit 后首次 test | test 后 edit 不倒算 |
| It Works Eventually | 4 fail + pass | 5 fail + pass | fail 后无 pass 不解锁 |
| Surely This Time | 不同命令失败 | 同命令连续失败 5 次 | 中间换命令应重置连续性 |
| Touch Grass | 99 tool calls | 100 tool calls | 101 不重复 unlock |

## Definition of Done

- [ ] 新架构关键纯函数都有测试
- [ ] 6 个 Behavior Achievement 都有 negative/positive/edge case
- [ ] migration、persistence、idempotency 有回归测试
- [ ] Toast baseline bug 有回归测试
- [ ] 测试失败时能明确定位 classifier / reducer / evaluate 哪一层出错
