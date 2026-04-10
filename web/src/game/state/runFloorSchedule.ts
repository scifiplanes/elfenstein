import type { FloorGenDifficulty, FloorType } from '../../procgen/types'

/**
 * Segment order: each segment spans `campEveryFloors` dungeon floors (see `clampCampEveryFloors`),
 * then a camp hub; the next segment uses the next type.
 */
export const FLOOR_TYPE_ORDER: readonly FloorType[] = [
  'Cave',
  'Ruins',
  'Dungeon',
  'Jungle',
  'Catacombs',
  'Palace',
  'Bunker',
  'LivingBio',
  'Golem',
]

export function clampCampEveryFloors(n: number | undefined): number {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v) || v < 1) return 10
  return Math.min(99, Math.max(1, v))
}

export function segmentIndexForFloor(floorIndex: number, campEvery: number): number {
  const n = clampCampEveryFloors(campEvery)
  return Math.floor(Math.max(0, floorIndex) / n)
}

export function floorTypeForFloorIndex(floorIndex: number, campEvery: number): FloorType {
  const seg = segmentIndexForFloor(floorIndex, campEvery)
  return FLOOR_TYPE_ORDER[seg % FLOOR_TYPE_ORDER.length]!
}

/** Segments 0–1 easy, 2–4 normal, 5+ hard. */
export function difficultyForSegment(segmentIndex: number): FloorGenDifficulty {
  if (segmentIndex <= 1) return 0
  if (segmentIndex <= 4) return 1
  return 2
}

/** After completing floor `nextFloorIndex - 1`, open camp before playing `nextFloorIndex`. */
export function shouldOpenCampHub(nextFloorIndex: number, campEvery: number): boolean {
  const n = clampCampEveryFloors(campEvery)
  return nextFloorIndex > 0 && nextFloorIndex % n === 0
}
