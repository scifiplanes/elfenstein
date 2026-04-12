import { describe, expect, it, vi } from 'vitest'
import { mulberry32 } from './seededRng'
import { generateDungeon } from './generateDungeon'
import {
  planMissionBeforeGeometry,
  plannedMissionTargetLockCount,
  validatePlannedMission,
  validatePlannedMissionRealized,
} from './missionFirst'
import type { PlannedMission } from './types'

describe('validatePlannedMission', () => {
  it('accepts shipped Palace templates', () => {
    const spine: PlannedMission = {
      templateId: 'palace_spine',
      nodes: [
        { id: 'n_e', role: 'Entrance' },
        { id: 'n_x', role: 'Exit' },
      ],
      edges: [{ fromId: 'n_e', toId: 'n_x', kind: 'walk' }],
    }
    expect(validatePlannedMission(spine)).toBe(true)

    const a: PlannedMission = {
      templateId: 'palace_seal_a',
      nodes: [
        { id: 'n_e', role: 'Entrance' },
        { id: 'n_ka', role: 'KeyPickup', lockId: 'A' },
        { id: 'n_ga', role: 'LockGate', lockId: 'A' },
        { id: 'n_x', role: 'Exit' },
      ],
      edges: [
        { fromId: 'n_e', toId: 'n_ka', kind: 'walk' },
        { fromId: 'n_ka', toId: 'n_ga', kind: 'walk' },
        { fromId: 'n_ga', toId: 'n_x', kind: 'gated', lockId: 'A' },
      ],
    }
    expect(validatePlannedMission(a)).toBe(true)

    const ab: PlannedMission = {
      templateId: 'palace_seal_ab',
      nodes: [
        { id: 'n_e', role: 'Entrance' },
        { id: 'n_ka', role: 'KeyPickup', lockId: 'A' },
        { id: 'n_ga', role: 'LockGate', lockId: 'A' },
        { id: 'n_kb', role: 'KeyPickup', lockId: 'B' },
        { id: 'n_gb', role: 'LockGate', lockId: 'B' },
        { id: 'n_x', role: 'Exit' },
      ],
      edges: [
        { fromId: 'n_e', toId: 'n_ka', kind: 'walk' },
        { fromId: 'n_ka', toId: 'n_ga', kind: 'walk' },
        { fromId: 'n_ga', toId: 'n_kb', kind: 'gated', lockId: 'A' },
        { fromId: 'n_kb', toId: 'n_gb', kind: 'walk' },
        { fromId: 'n_gb', toId: 'n_x', kind: 'gated', lockId: 'B' },
      ],
    }
    expect(validatePlannedMission(ab)).toBe(true)
  })

  it('rejects exit reachable before keys when gates exist', () => {
    const bad: PlannedMission = {
      templateId: 'palace_spine',
      nodes: [
        { id: 'n_e', role: 'Entrance' },
        { id: 'n_ka', role: 'KeyPickup', lockId: 'A' },
        { id: 'n_ga', role: 'LockGate', lockId: 'A' },
        { id: 'n_x', role: 'Exit' },
      ],
      edges: [
        { fromId: 'n_e', toId: 'n_x', kind: 'walk' },
        { fromId: 'n_e', toId: 'n_ka', kind: 'walk' },
        { fromId: 'n_ka', toId: 'n_ga', kind: 'walk' },
      ],
    }
    expect(validatePlannedMission(bad)).toBe(false)
  })

  it('rejects key behind its gate', () => {
    const bad: PlannedMission = {
      templateId: 'palace_seal_a',
      nodes: [
        { id: 'n_e', role: 'Entrance' },
        { id: 'n_ga', role: 'LockGate', lockId: 'A' },
        { id: 'n_ka', role: 'KeyPickup', lockId: 'A' },
        { id: 'n_x', role: 'Exit' },
      ],
      edges: [
        { fromId: 'n_e', toId: 'n_ga', kind: 'walk' },
        { fromId: 'n_ga', toId: 'n_ka', kind: 'gated', lockId: 'A' },
        { fromId: 'n_ka', toId: 'n_x', kind: 'walk' },
      ],
    }
    expect(validatePlannedMission(bad)).toBe(false)
  })
})

describe('plannedMissionTargetLockCount', () => {
  it('matches gated edge lock ids', () => {
    const spine: PlannedMission = {
      templateId: 'palace_spine',
      nodes: [
        { id: 'n_e', role: 'Entrance' },
        { id: 'n_x', role: 'Exit' },
      ],
      edges: [{ fromId: 'n_e', toId: 'n_x', kind: 'walk' }],
    }
    expect(plannedMissionTargetLockCount(spine)).toBe(0)
  })
})

describe('planMissionBeforeGeometry', () => {
  it('returns null for non-Palace', () => {
    const rng = mulberry32(12_345)
    expect(
      planMissionBeforeGeometry(
        { seed: 1, w: 40, h: 40, floorType: 'Dungeon', difficulty: 1 },
        rng,
      ),
    ).toBeNull()
  })

  it('is deterministic for Palace on the same mission stream seed', () => {
    const a = planMissionBeforeGeometry({ seed: 1, w: 40, h: 40, floorType: 'Palace', difficulty: 1 }, mulberry32(99_001))
    const b = planMissionBeforeGeometry({ seed: 1, w: 40, h: 40, floorType: 'Palace', difficulty: 1 }, mulberry32(99_001))
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a!.templateId).toBe(b!.templateId)
    expect(a!.nodes.map((n) => n.id).join(',')).toBe(b!.nodes.map((n) => n.id).join(','))
  })
})

describe('Palace generateDungeon + validatePlannedMissionRealized', () => {
  it('produces floors that satisfy the planned lock template', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const out = generateDungeon({
        seed: 42_424_242,
        w: 48,
        h: 48,
        floorIndex: 3,
        floorType: 'Palace',
        difficulty: 1,
      })
      expect(out.meta.plannedMission).toBeDefined()
      expect(out.meta.genVersion).toBe(7)
      expect(validatePlannedMissionRealized(out, out.meta.plannedMission!)).toBe(true)
    } finally {
      warn.mockRestore()
    }
  })
})
