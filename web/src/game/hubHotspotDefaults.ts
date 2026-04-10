import type { HubHotspotConfig, HubNormRect } from './types'

export type HubHotspotPatch = {
  village?: { tavern?: Partial<HubNormRect>; cave?: Partial<HubNormRect> }
  tavern?: { innkeeper?: Partial<HubNormRect>; innkeeperTrade?: Partial<HubNormRect> }
}

export function mergeHubHotspotConfig(base: HubHotspotConfig, patch: HubHotspotPatch | undefined): HubHotspotConfig {
  if (!patch) return base
  return {
    village: {
      tavern: { ...base.village.tavern, ...patch.village?.tavern },
      cave: { ...base.village.cave, ...patch.village?.cave },
    },
    tavern: {
      innkeeper: { ...base.tavern.innkeeper, ...patch.tavern?.innkeeper },
      innkeeperTrade: { ...base.tavern.innkeeperTrade, ...patch.tavern?.innkeeperTrade },
    },
  }
}

/** Normalized 0–1 rects inside the game viewport cell (hub 2D scenes). */
export const DEFAULT_HUB_HOTSPOTS: HubHotspotConfig = {
  village: {
    tavern: { x: 0.12, y: 0.55, w: 0.22, h: 0.18 },
    cave: { x: 0.68, y: 0.52, w: 0.2, h: 0.2 },
  },
  tavern: {
    innkeeper: { x: 0.38, y: 0.35, w: 0.24, h: 0.28 },
    // Trade click: `HubViewport` pins top to **350px** (`fixedTopPx`); **y** is ignored for layout. **h** = 50% of game viewport height.
    innkeeperTrade: { x: 0.36, y: 0.14, w: 0.28, h: 0.5 },
  },
}
