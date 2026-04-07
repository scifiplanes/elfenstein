import type { Rng } from './seededRng'
import type { DistrictTag, FloorProperty, GenRoom } from './types'

const DISTRICT_POOL: DistrictTag[] = ['NorthWing', 'SouthWing', 'EastWing', 'WestWing', 'Core', 'Ruin']

/** Seeded Voronoi on room centers: each room gets a district tag (deterministic tie-break by room id). */
export function assignDistrictsToRooms(rooms: GenRoom[], w: number, h: number, rng: Pick<Rng, 'next'>): void {
  if (!rooms.length) return

  const k = Math.min(4, Math.max(2, Math.floor(Math.sqrt(rooms.length)) + 1))
  const seeds: Array<{ x: number; y: number; tag: DistrictTag }> = []
  for (let i = 0; i < k; i++) {
    const x = 2 + Math.floor(rng.next() * Math.max(1, w - 4))
    const y = 2 + Math.floor(rng.next() * Math.max(1, h - 4))
    seeds.push({ x, y, tag: DISTRICT_POOL[i % DISTRICT_POOL.length] })
  }

  const sortedRooms = [...rooms].sort((a, b) => a.id.localeCompare(b.id))
  for (const r of sortedRooms) {
    const cx = r.center.x
    const cy = r.center.y
    let best = seeds[0]
    let bestD = (cx - best.x) ** 2 + (cy - best.y) ** 2
    for (let s = 1; s < seeds.length; s++) {
      const d = (cx - seeds[s].x) ** 2 + (cy - seeds[s].y) ** 2
      if (d < bestD || (d === bestD && seeds[s].tag.localeCompare(best.tag) < 0)) {
        bestD = d
        best = seeds[s]
      }
    }
    r.district = best.tag
  }
}

/**
 * Quota-aware tagging (deterministic room id order) + floor property bias from DESIGN taxonomy.
 */
export function tagRoomsWithQuotas(
  rooms: GenRoom[],
  floorProperties: FloorProperty[] | undefined,
  rng: Pick<Rng, 'next'>,
): void {
  const props = floorProperties ?? []
  const has = (p: FloorProperty) => props.includes(p)
  const sorted = [...rooms].sort((a, b) => a.id.localeCompare(b.id))

  let storageQuota = Math.min(2, Math.max(1, Math.floor(sorted.length / 5)))

  for (const r of sorted) {
    const area = r.rect.w * r.rect.h
    const size = area <= 20 ? 'tiny' : area <= 48 ? 'medium' : 'large'

    let roomFunction: NonNullable<GenRoom['tags']>['roomFunction']
    if (size === 'tiny') {
      if (storageQuota > 0 && rng.next() < 0.55) {
        roomFunction = 'Storage'
        storageQuota--
      } else {
        roomFunction = 'Passage'
      }
    } else if (size === 'large') {
      roomFunction = rng.next() < 0.55 ? 'Communal' : 'Workshop'
    } else {
      roomFunction = rng.next() < 0.5 ? 'Habitat' : 'Passage'
    }

    const roomStatus =
      has('Overgrown') && rng.next() < 0.35 ? 'Overgrown' : has('Destroyed') && rng.next() < 0.25 ? 'Destroyed' : undefined

    const roomProperties =
      has('Infested') && rng.next() < 0.28 ? 'Infected' : has('Cursed') && rng.next() < 0.12 ? 'Burning' : undefined

    r.tags = { ...(r.tags ?? {}), size, roomFunction, roomStatus, roomProperties }
  }

  if (!sorted.some((r) => r.tags?.roomFunction === 'Storage')) {
    const tinies = sorted.filter((r) => r.tags?.size === 'tiny').sort((a, b) => a.rect.w * a.rect.h - (b.rect.w * b.rect.h))
    const victim = tinies[0]
    if (victim?.tags) victim.tags.roomFunction = 'Storage'
  }
}
