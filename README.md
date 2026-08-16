# dsh-achievements 🏆

> An achievement / gamification plugin for DeepSeek Harness: cross-session badges for turns, tool calls, sessions and daily streaks, with a badge panel, unlock toasts and a `ctx.achievements` service. Zero core changes. A fork of [Blaczz/dsh-achievements](https://github.com/Blaczz/dsh-achievements) adding behavior achievements, the `ctx.achievements` SDK and a sharing layer.

[English](./README.md) | [简体中文](./README.zh.md)

A **DeepSeek Harness (DSH)** gamification plugin that quietly counts your real usage (turns, tool calls, sessions, consecutive days) and unlocks achievements at milestones, toasting in real time and showing a badge wall in the settings page. State survives across sessions (stored in the DSH home directory), and all counting rides the official `session/event` seam (`turn/end`, `tool/call`, `tool/result`) — **no core changes**.

## ✨ Built-in achievements (68)

Achievements come in two tracks. Each of the **seven lifetime progression lines** has five tiers, always `common → uncommon → rare → epic → legendary` (10 / 30 / 75 / 175 / 400 XP for new milestones):

| Line | Common | Uncommon | Rare | Epic | Legendary |
|---|---:|---:|---:|---:|---:|
| 🎬 Turns | 1 | 25 | 50 | 100 | 500 |
| 🔧 Tool calls | 1 | 25 | 100 | 500 | 2000 |
| 💬 Sessions | 1 | 10 | 50 | 200 | 500 |
| 🌅 Active days | 1 | 7 | 30 | 100 | 365 |
| 📖 File reads | 10 | 100 | 500 | 2500 | 10000 |
| ✏️ File edits | 1 | 10 | 50 | 250 | 1000 |
| 🧪 Test runs | 1 | 10 | 50 | 250 | 1000 |

Plus **special achievements**: streak days (`streak-3` / `streak-7`), the early `ten-turns` bonus, and ten per-session behavior badges:

| Achievement | Condition |
|---|---|
| 🔁 Déjà Vu | edit the same file 5 times in one session |
| 🕳 Rabbit Hole | read 20 files before your first edit |
| 💣 YOLO | edit 8 files before your first test |
| 🔥 It Works Eventually | pass after 5 failed tests |
| 🎰 Surely This Time | same test command fails 5 times in a row |
| 🎯 One Shot | pass the first test after a single edit |
| 📚 Librarian | read 30 distinct files in one session |
| 🌱 Touch Grass | 100 tool calls in one session |
| 🦴 Dependency Archaeologist | read a file inside a dependency directory |
| 🗿 Gigachad | read, edit and pass a test within 5 tool calls |

P7 adds 20 **session trajectory achievements** across four five-tier chains (rarity always `common → uncommon → rare → epic → legendary`, XP 10 / 20 / 40 / 70 / 120). They read only low-frequency boundaries (`step/start`, `assistant/message`, `step/end`, settled tool calls) and never persist per-token chunks:

| Chain | Metric | Five thresholds |
|---|---|---|
| 💬 Session Marathon | distinct closed-step turns in one session | 5 / 20 / 50 / 100 / 200 |
| 🪜 Turn Depth | closed steps within a single turn | 5 / 20 / 50 / 100 / 500 |
| 🔧 Tool Barrage | settled tool calls within a single step (incl. Code Mode sub-calls) | 5 / 10 / 25 / 50 / 100 |
| ⏳ Time Anomaly | single model-request think duration (`step/start → assistant/message`, hidden) | 30s / 100s / 300s / 500s / 1000s |

Lifetime counters (`turns`, `toolCalls`, `sessions`, `activeDays`, `fileReads`, `fileEdits`, `testRuns`) live on the profile and never depend on the 64-session retention window. On upgrade, missing counters are conservatively recovered from the retained sessions as a provable lower bound, and already-satisfied lifetime milestones are silently unlocked once (no toast storm). P7 trajectory achievements are non-retroactive session behavior and are never backfilled.

## 📦 Install

Prereqs: DSH (`dsh web` works), Node ≥ 22.19, pnpm.

```bash
# From GitHub (prebuilt lib/ committed, no allowBuilds needed)
dsh plugin --profile web add "github:luumod/dsh-achievements#main"

# Local directory
cd dsh-achievements && npm install --legacy-peer-deps && npm run build
dsh plugin --profile web add ./dsh-achievements
```

**Restart `dsh web` after install**, then just use it — the first completed turn unlocks the first achievement.

## 🎮 Usage

1. Chat and let the agent work: turns, tool calls, new sessions and daily activity accumulate; a toast pops when a new achievement unlocks.
2. **Settings → 🏆 成就**: seven lifetime counters (turns / tool calls / sessions / active days / file reads / file edits / test runs) plus a separate streak line; the badge wall is collapsed into the seven growth routes and the special chains, each group header shows its progress, and a single "all / locked / unlocked" filter narrows the cards. Special behavior groups into "其它 / 经典行为, 连续作战, 行为狂人, 会话马拉松, 单轮深潜, 工具齐射, 时间异象"; unlocked cards carry timestamps, locked cards are dimmed, and hidden achievements stay `???` until unlocked.

## 🔌 For developers: the `ctx.achievements` SDK

Register your own achievements from a Host plugin (built-in and third-party share one evaluation path):

```ts
export const inject = ['achievements']

export function apply(ctx: Context): void {
  ctx.achievements.register({
    id: 'python-first-run',
    icon: '🐍',
    title: { zh: '蟒蛇出洞', en: 'First Python Run' },
    description: { zh: '首次运行 Python', en: 'Run Python for the first time' },
    rarity: 'uncommon',
    xp: 20,
    scope: 'session',
    evaluate: ctx => ({ unlocked: ctx.session.toolCalls >= 1 }),
  })
}
```

Or register a whole pack: `ctx.achievements.registerPack({ id, version, name, achievements })`. Duplicate ids throw. See `docs/SDK.md` for the full guide + `examples/python-pack.ts`.

On the browser side, other client plugins read state via `ctx.achievementsState.refresh()` / `ctx.achievementsState.unlockedIds()`.

## 🛠️ Development

```bash
npm install --legacy-peer-deps
$env:DSH_NODE_MODULES = "$env:USERPROFILE\.dsh\profiles\node_modules"
npm run setup:dsh-workspace
npm run verify                          # ★ one-shot gate: clean + typecheck + test + build
npm test                                # vitest (engine unlock rules / streaks / idempotency + manifest)
```

## Layout

```
dsh-achievements/
├── package.json            # dual contract: dsh.bundle.patch + dsh.client
├── cordis.patch.yml        # bundle patch layer
├── tsdown.config.ts        # client bundle (__ModuleLoader__.load + purity gate)
├── scripts/                # build / clean / setup-dsh-workspace / verify
├── src/
│   ├── achievements.ts     # ★ pure engine (applyEvent / BUILTIN_ACHIEVEMENTS, unit-testable)
│   ├── state.ts            # persistence (JSON in the DSH home)
│   ├── index.ts            # host half: event hooks + HTTP API + settings
│   └── client/             # browser half
│       ├── index.ts        # apply: ctx.achievements service + polling + slot injection
│       ├── achievements-client.ts  # state API client
│       ├── badge-panel.tsx # badge wall (settings.section)
│       └── toast.ts        # unlock toast (zero-dependency DOM)
└── tests/                  # engine + manifest
```

## 🧩 Ecosystem positioning

- **Fills a gap**: before this, the DSH ecosystem had **no unified achievement/badge system** (only `dsh-daily-progress` tracks streaks/completion), and community research explicitly flagged "no real gamification tasks/achievements/levels".
- **Technical route**: host drives a pure engine off the official event seams (`session/event` + `tools/result`); the browser half is a client plugin (`settings.section` + polling), the same dual-sided pattern as `dsh-soundscape`.
- **Zero core changes**: read-only events + a private state file + `ctx.effect` registrations.

## ⚖️ License

MIT © 2026 Blaczz (upstream). This repo is a fork of [Blaczz/dsh-achievements](https://github.com/Blaczz/dsh-achievements), adding behavior achievements, the `ctx.achievements` SDK and a sharing layer on top; if the upstream PR lands, this fork will be archived in favor of the original. An independent community plugin, not affiliated with [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
