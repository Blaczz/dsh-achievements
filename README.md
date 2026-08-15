# dsh-achievements 🏆

> An achievement / gamification plugin for DeepSeek Harness: cross-session badges for turns, tool calls, sessions and daily streaks, with a badge panel, unlock toasts and a `ctx.achievements` service. Zero core changes.

[English](./README.md) | [简体中文](./README.zh.md)

A **DeepSeek Harness (DSH)** gamification plugin that quietly counts your real usage (turns, tool calls, sessions, consecutive days) and unlocks achievements at milestones, toasting in real time and showing a badge wall in the settings page. State survives across sessions (stored in the DSH home directory), and all counting rides the official `session/event` seam (`turn/end`, `tool/call`, `tool/result`) — **no core changes**.

## ✨ Built-in achievements

| Achievement | Condition |
|---|---|
| 🎬 First Turn | complete 1 turn |
| 🔟 Warming Up | 10 turns |
| 💯 Century Club | 100 turns |
| 🔧 Tool Time | first tool call |
| 🛠️ Power Tooler | 100 tool calls |
| 📚 Session Collector | 10 sessions |
| 🔥 Three-Day Streak | 3 consecutive active days |
| 🌋 Week on Fire | 7 consecutive active days |

Behavior achievements (per-session, v0.2):

| Achievement | Condition |
|---|---|
| 🔁 Déjà Vu | edit the same file 5 times in one session |
| 🕳 Rabbit Hole | read 20 files before your first edit |
| 💣 YOLO | edit 8 files before your first test |
| 🔥 It Works Eventually | pass after 5 failed tests |
| 🎰 Surely This Time | same test command fails 5 times in a row |
| 🌱 Touch Grass | 100 tool calls in one session |

## 📦 Install

Prereqs: DSH (`dsh web` works), Node ≥ 22.19, pnpm.

```bash
# From GitHub (prebuilt lib/ committed, no allowBuilds needed)
dsh plugin --profile web add "github:Blaczz/dsh-achievements#main"

# Local directory
cd dsh-achievements && npm install --legacy-peer-deps && npm run build
dsh plugin --profile web add ./dsh-achievements
```

**Restart `dsh web` after install**, then just use it — the first completed turn unlocks the first achievement.

## 🎮 Usage

1. Chat and let the agent work: turns, tool calls, new sessions and daily activity accumulate; a toast pops when a new achievement unlocks.
2. **Settings → 🏆 成就**: four counters (turns / tool calls / sessions / streak) plus the badge wall (unlocked with timestamps, locked dimmed).

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

MIT © 2026 Blaczz. An independent community plugin, not affiliated with [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
