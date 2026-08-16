/** Achievement SDK: registry, ID conflicts, packs, and the shared evaluation path. */
import { describe, expect, it } from 'vitest'
import { applyEvent, BUILTIN_PACK } from '../src/achievements.ts'
import type { AchievementDef } from '../src/achievements.ts'
import type { AchievementEvent } from '../src/events.ts'
import { createInitialState } from '../src/state.ts'
import { createAchievementRegistry } from '../src/sdk.ts'

const T = 1_700_000_000_000

function makeDef(id: string, evaluate: AchievementDef['evaluate']): AchievementDef {
  return {
    id,
    icon: '❓',
    title: { zh: id, en: id },
    description: { zh: id, en: id },
    rarity: 'common',
    xp: 10,
    scope: 'session',
    evaluate,
  }
}

function fileRead(sessionId: string, seq: number, path: string): AchievementEvent {
  return { kind: 'tool-call', sessionId, seq, callId: null, tool: { kind: 'file-read', name: 'read', path }, isError: false }
}

describe('achievement registry', () => {
  it('registers defs and lists them in order', () => {
    const registry = createAchievementRegistry()
    registry.register(makeDef('a', () => ({ unlocked: false })))
    registry.register(makeDef('b', () => ({ unlocked: false })))
    expect(registry.list().map(d => d.id)).toEqual(['a', 'b'])
  })

  it('throws on a duplicate achievement id', () => {
    const registry = createAchievementRegistry()
    registry.register(makeDef('a', () => ({ unlocked: false })))
    expect(() => registry.register(makeDef('a', () => ({ unlocked: false })))).toThrow(/duplicate achievement id: "a"/)
  })

  it('registerPack registers every achievement and throws on the first duplicate', () => {
    const registry = createAchievementRegistry()
    registry.registerPack({ id: 'pack', version: '1.0.0', achievements: [makeDef('a', () => ({ unlocked: false })), makeDef('b', () => ({ unlocked: false }))] })
    expect(registry.list().map(d => d.id)).toEqual(['a', 'b'])
    expect(() => registry.registerPack({ id: 'pack2', version: '1.0.0', achievements: [makeDef('a', () => ({ unlocked: false }))] })).toThrow(/duplicate achievement id/)
  })

  it('registers the builtin pack through the same registry path', () => {
    const registry = createAchievementRegistry()
    registry.registerPack(BUILTIN_PACK)
    expect(registry.list().length).toBe(48)
    expect(registry.list()[0]!.id).toBe('first-turn')
  })
})

describe('registered achievements evaluate through the engine', () => {
  it('unlocks a third-party session-scoped achievement from real events', () => {
    const registry = createAchievementRegistry()
    registry.register(makeDef('read-twice', ctx => ({ unlocked: (ctx.session.filesRead['a.txt'] ?? 0) >= 2 })))
    let state = createInitialState()
    state = applyEvent(state, fileRead('s', 0, 'a.txt'), registry.list(), '2026-01-01', T).state
    expect(state.profile.unlocked['read-twice']).toBeUndefined()
    const result = applyEvent(state, fileRead('s', 1, 'a.txt'), registry.list(), '2026-01-01', T + 1)
    expect(result.newlyUnlocked.map(d => d.id)).toContain('read-twice')
  })
})
