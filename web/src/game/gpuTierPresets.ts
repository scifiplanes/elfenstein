import type { GpuTier, RenderTuning } from './types'

/** Keys that define a named GPU tier; changing any via `render/set` forces `gpuTier: 'custom'`. */
export const TIER_OWNED_RENDER_KEYS = [
  'pixelRatioCap',
  'shadowLanternPoint',
  'shadowLanternBeam',
  'shadowMapSize',
  'shadowFilter',
  'torchPoiLightMax',
  'ditherStrength',
  'ditherMatrixSize',
] as const

export type TierOwnedRenderKey = (typeof TIER_OWNED_RENDER_KEYS)[number]

export function isTierOwnedRenderKey(key: keyof RenderTuning): key is TierOwnedRenderKey {
  return (TIER_OWNED_RENDER_KEYS as readonly string[]).includes(key as string)
}

const GPU_TIER_PRESETS: Record<Exclude<GpuTier, 'custom'>, Partial<RenderTuning>> = {
  low: {
    pixelRatioCap: 1.0,
    shadowLanternPoint: 0,
    shadowLanternBeam: 0,
    shadowMapSize: 128,
    shadowFilter: 0,
    torchPoiLightMax: 1,
    ditherStrength: 0.38,
    ditherMatrixSize: 2,
  },
  balanced: {
    pixelRatioCap: 1.25,
    shadowLanternPoint: 0,
    shadowLanternBeam: 1,
    shadowMapSize: 256,
    shadowFilter: 1,
    torchPoiLightMax: 2,
    ditherStrength: 0.55,
    ditherMatrixSize: 4,
  },
  high: {
    pixelRatioCap: 1.5,
    shadowLanternPoint: 0,
    shadowLanternBeam: 1,
    shadowMapSize: 256,
    shadowFilter: 2,
    torchPoiLightMax: 3,
    ditherStrength: 0.55,
    ditherMatrixSize: 4,
  },
}

/** Merge preset fields into current render tuning and set `gpuTier` (only for low / balanced / high). */
export function applyGpuTierToRender(render: RenderTuning, tier: Exclude<GpuTier, 'custom'>): RenderTuning {
  return { ...render, ...GPU_TIER_PRESETS[tier], gpuTier: tier }
}
