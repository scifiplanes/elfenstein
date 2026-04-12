import { describe, expect, it } from 'vitest'
import { campHubSkinForFloorType } from './campHubSkin'

describe('campHubSkinForFloorType', () => {
  it('maps Cave profile to cave', () => {
    expect(campHubSkinForFloorType('Cave')).toBe('cave')
    expect(campHubSkinForFloorType('Jungle')).toBe('cave')
    expect(campHubSkinForFloorType('LivingBio')).toBe('cave')
  })

  it('maps Dungeon profile to dungeon', () => {
    expect(campHubSkinForFloorType('Dungeon')).toBe('dungeon')
    expect(campHubSkinForFloorType('Bunker')).toBe('dungeon')
    expect(campHubSkinForFloorType('Golem')).toBe('dungeon')
  })

  it('never returns a village skin for Ruins-profile floor types', () => {
    expect(campHubSkinForFloorType('Ruins')).toBe('cave')
    expect(campHubSkinForFloorType('Catacombs')).toBe('dungeon')
    expect(campHubSkinForFloorType('Palace')).toBe('dungeon')
  })
})
