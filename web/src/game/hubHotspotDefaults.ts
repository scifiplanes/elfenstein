import type { HubHotspotConfig, HubNormRect } from './types'

export type HubHotspotPatch = {
  village?: { tavern?: Partial<HubNormRect>; cave?: Partial<HubNormRect> }
  tavern?: { innkeeper?: Partial<HubNormRect>; exit?: Partial<HubNormRect> }
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
      exit: { ...base.tavern.exit, ...patch.tavern?.exit },
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
    exit: { x: 0.08, y: 0.72, w: 0.16, h: 0.14 },
  },
}
