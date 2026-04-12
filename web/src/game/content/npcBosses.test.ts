import { describe, expect, it } from 'vitest'
import type { GenRoom } from '../../procgen/types'
import {
  bossSpawnMatchesRoom,
  getBossDefinitionByTraitId,
  resolveNpcCombatTuning,
} from './npcBosses'
import { npcCombatTuningFromContent } from './npcCombat'

describe('npcBosses', () => {
  it('resolveNpcCombatTuning matches base stats for normal NPCs', () => {
    const base = npcCombatTuningFromContent('Wurglepup')
    const t = resolveNpcCombatTuning({ kind: 'Wurglepup' })
    expect(t).toEqual(base)
  })

  it('boss Skeleton is faster than base Skeleton', () => {
    const base = npcCombatTuningFromContent('Skeleton')
    const t = resolveNpcCombatTuning({
      kind: 'Skeleton',
      variant: 'boss',
      bossTraitId: 'boss_skeleton',
    })
    expect(t.speed).toBeGreaterThan(base.speed)
  })

  it('bossSpawnMatchesRoom respects floor property gate for Skeleton', () => {
    const room: GenRoom = {
      id: 'r1',
      rect: { x: 0, y: 0, w: 5, h: 5 },
      center: { x: 2, y: 2 },
      leafDepth: 0,
      tags: { roomFunction: 'Passage' },
      district: 'Core',
    }
    const def = getBossDefinitionByTraitId('boss_skeleton')!
    const ctxBase = {
      floorType: 'Dungeon' as const,
      floorIndex: 0,
      floorProperties: [] as const,
      rng: { next: () => 0.5, int: (a: number, b: number) => a, pick: <T,>(a: readonly T[]) => a[0]! },
      roomDist: 5,
      onPath: true,
      neighborRoomFunctions: {},
      deepDistThreshold: 0,
      shallowDistMax: 99,
    }
    expect(bossSpawnMatchesRoom(def, ctxBase, room)).toBe(false)
    expect(
      bossSpawnMatchesRoom(def, { ...ctxBase, floorProperties: ['Cursed'] as const }, room),
    ).toBe(true)
  })
})
