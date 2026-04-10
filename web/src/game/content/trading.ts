import type { NpcTrade } from '../types'

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
