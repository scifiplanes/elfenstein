import { describe, expect, it } from 'vitest'
import type { Tile } from '../game/types'
import { resolveWorldPickHit } from './resolveWorldPickHit'

function hit(kind: string, id: string) {
  return { object: { userData: { kind, id } }, tag: `${kind}:${id}` }
}

describe('resolveWorldPickHit', () => {
  const w = 8
  const tiles: Tile[] = Array(w * w).fill('floor')
  const doorIdx = 3 + 4 * w
  const openIdx = 4 + 4 * w
  tiles[doorIdx] = 'door'
  tiles[openIdx] = 'doorOpen'

  it('returns first floorItem on the ray (after passable open door is deferred)', () => {
    const h = [hit('door', '4,4'), hit('floorItem', 'i1'), hit('poi', 'p1')]
    expect(resolveWorldPickHit(h, tiles, w)).toBe(h[1])
  })

  it('returns closed door and ignores poi behind', () => {
    const h = [hit('door', '3,4'), hit('poi', 'p1')]
    expect(resolveWorldPickHit(h, tiles, w)).toBe(h[0])
  })

  it('returns poi when open door is closer on the ray', () => {
    const h = [hit('door', '4,4'), hit('poi', 'p1')]
    expect(resolveWorldPickHit(h, tiles, w)).toBe(h[1])
  })

  it('returns open door when npc is farther (open door closer)', () => {
    const h = [hit('door', '4,4'), hit('npc', 'n1')]
    expect(resolveWorldPickHit(h, tiles, w)).toBe(h[0])
  })

  it('returns npc when npc is closer than open door', () => {
    const h = [hit('npc', 'n1'), hit('door', '4,4')]
    expect(resolveWorldPickHit(h, tiles, w)).toBe(h[0])
  })

  it('returns lone passable open door hit', () => {
    const h = [hit('door', '4,4')]
    expect(resolveWorldPickHit(h, tiles, w)).toBe(h[0])
  })

  it('skips hits with empty id', () => {
    const h = [hit('door', ''), hit('poi', 'p1')]
    expect(resolveWorldPickHit(h, tiles, w)).toBe(h[1])
  })
})
