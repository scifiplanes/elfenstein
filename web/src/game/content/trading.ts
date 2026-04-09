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
