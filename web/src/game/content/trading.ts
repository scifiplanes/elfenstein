import type { NpcTrade } from '../types'

function cloneNpcTrade(t: NpcTrade): NpcTrade {
  return {
    stock: t.stock.map((r) => ({ defId: r.defId, qty: r.qty })),
    wants: [...t.wants],
  }
}

/**
 * Procgen templates for friendly floor NPCs (Elder, Snailord, Bok, RegularBok, Grechka).
 * Picked deterministically via `pickFloorFriendlyNpcTrade`; stock depletes on the NPC row at runtime.
 */
export const FLOOR_FRIENDLY_NPC_TRADE_TEMPLATES: readonly NpcTrade[] = [
  {
    stock: [
      { defId: 'Mushrooms', qty: 3 },
      { defId: 'HerbTea', qty: 2 },
      { defId: 'Flourball', qty: 1 },
    ],
    wants: ['Stone', 'Stick', 'Foodroot'],
  },
  {
    stock: [
      { defId: 'BitterHerb', qty: 2 },
      { defId: 'Salt', qty: 2 },
      { defId: 'TravelFlaskEmpty', qty: 1 },
    ],
    wants: ['Ash', 'Mushrooms', 'Glowbug'],
  },
  {
    stock: [
      { defId: 'BandageStrip', qty: 2 },
      { defId: 'HerbTea', qty: 3 },
    ],
    wants: ['Flourball', 'Chisel', 'ClothScrap'],
  },
]

/** Deterministic catalog for one procgen friendly merchant spawn. */
export function pickFloorFriendlyNpcTrade(
  rng: { int(min: number, maxExclusive: number): number },
  npcIndex: number,
): NpcTrade {
  const n = FLOOR_FRIENDLY_NPC_TRADE_TEMPLATES.length
  const i = rng.int(0, n)
  const j = (i + npcIndex * 17) % n
  return cloneNpcTrade(FLOOR_FRIENDLY_NPC_TRADE_TEMPLATES[j]!)
}

/** Default tavern innkeeper catalog (per-run quantities persist in `run.hubInnkeeperTradeStock`). */
export const HUB_INNKEEPER_TRADE: NpcTrade = {
  stock: [
    { defId: 'Flourball', qty: 3 },
    { defId: 'HerbTea', qty: 2 },
    { defId: 'WaterbagFull', qty: 1 },
  ],
  wants: ['Stone', 'Stick', 'Mushrooms', 'Foodroot'],
}

/** Camp tavern merchant (mid-run hub); separate defaults from the starting village innkeeper. */
export const CAMP_INNKEEPER_TRADE: NpcTrade = {
  stock: [
    { defId: 'HerbTea', qty: 5 },
    { defId: 'BandageStrip', qty: 3 },
    { defId: 'Salt', qty: 2 },
  ],
  wants: ['Ash', 'Flourball', 'Chisel', 'IronKey'],
}
