import { describe, expect, it } from 'vitest'
import {
  clampCampEveryFloors,
  difficultyForSegment,
  floorTypeForFloorIndex,
  FLOOR_TYPE_ORDER,
  segmentIndexForFloor,
  shouldOpenCampHub,
} from './runFloorSchedule'

describe('runFloorSchedule', () => {
  it('clampCampEveryFloors', () => {
    expect(clampCampEveryFloors(undefined)).toBe(10)
    expect(clampCampEveryFloors(0)).toBe(10)
    expect(clampCampEveryFloors(1)).toBe(1)
    expect(clampCampEveryFloors(10)).toBe(10)
    expect(clampCampEveryFloors(99)).toBe(99)
    expect(clampCampEveryFloors(200)).toBe(99)
  })

  it('segment and floor type for N=10', () => {
    expect(segmentIndexForFloor(0, 10)).toBe(0)
    expect(floorTypeForFloorIndex(0, 10)).toBe('Cave')
    expect(segmentIndexForFloor(9, 10)).toBe(0)
    expect(floorTypeForFloorIndex(9, 10)).toBe('Cave')
    expect(segmentIndexForFloor(10, 10)).toBe(1)
    expect(floorTypeForFloorIndex(10, 10)).toBe('Ruins')
    expect(floorTypeForFloorIndex(19, 10)).toBe('Ruins')
    expect(floorTypeForFloorIndex(20, 10)).toBe('Dungeon')
  })

  it('shouldOpenCampHub', () => {
    expect(shouldOpenCampHub(0, 10)).toBe(false)
    expect(shouldOpenCampHub(10, 10)).toBe(true)
    expect(shouldOpenCampHub(20, 10)).toBe(true)
    expect(shouldOpenCampHub(3, 3)).toBe(true)
    expect(shouldOpenCampHub(2, 3)).toBe(false)
  })

  it('difficultyForSegment ramps', () => {
    expect(difficultyForSegment(0)).toBe(0)
    expect(difficultyForSegment(1)).toBe(0)
    expect(difficultyForSegment(2)).toBe(1)
    expect(difficultyForSegment(4)).toBe(1)
    expect(difficultyForSegment(5)).toBe(2)
  })

  it('FLOOR_TYPE_ORDER length and ninth is Golem', () => {
    expect(FLOOR_TYPE_ORDER.length).toBe(9)
    expect(FLOOR_TYPE_ORDER[8]).toBe('Golem')
  })
})
