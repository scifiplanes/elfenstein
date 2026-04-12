export type ThemeLightIntent = {
  /** Hex color used as the theme intent for all 3D lights. */
  intentHex: string
  /** Blend factor from base lantern color toward `intentHex` (0..1). */
  mix: number
  /** Optional scalar applied to torch intensity (keeps gameplay tuning shape, but shifts mood). */
  torchIntensityMult?: number
  /** Optional scalar applied to lantern intensity. */
  lanternIntensityMult?: number
}

const DEFAULT: ThemeLightIntent = { intentHex: '#ffd7a0', mix: 0.0, torchIntensityMult: 1.0, lanternIntensityMult: 1.0 }

/** One preset per id in `FLOOR_THEME_POOL` (`floorTheme.ts`). */
const PRESETS: Record<string, ThemeLightIntent> = {
  dungeon_warm: { intentHex: '#ff7a18', mix: 0.94, torchIntensityMult: 1.15, lanternIntensityMult: 1.05 },
  dungeon_cool: { intentHex: '#2aa6ff', mix: 0.96, torchIntensityMult: 1.0, lanternIntensityMult: 1.05 },
  cave_damp: { intentHex: '#00ffd1', mix: 0.97, torchIntensityMult: 0.95, lanternIntensityMult: 1.05 },
  cave_deep: { intentHex: '#1e3cff', mix: 0.985, torchIntensityMult: 0.9, lanternIntensityMult: 1.12 },
  ruins_bleach: { intentHex: '#fff1c2', mix: 0.93, torchIntensityMult: 1.25, lanternIntensityMult: 1.12 },
  // Earth umber (sienna/brown) — not fire red; keeps room-hazard Burning reads distinct.
  ruins_umber: { intentHex: '#9a6240', mix: 0.93, torchIntensityMult: 1.12, lanternIntensityMult: 1.06 },
  jungle_moss: { intentHex: '#4ade80', mix: 0.92, torchIntensityMult: 1.0, lanternIntensityMult: 1.04 },
  bio_chamber: { intentHex: '#e879a8', mix: 0.94, torchIntensityMult: 0.98, lanternIntensityMult: 1.05 },
  bunker_steel: { intentHex: '#94a3b8', mix: 0.9, torchIntensityMult: 1.0, lanternIntensityMult: 1.0 },
  catacomb_deep: { intentHex: '#78716c', mix: 0.94, torchIntensityMult: 0.92, lanternIntensityMult: 1.08 },
  nano_violet: { intentHex: '#a78bfa', mix: 0.96, torchIntensityMult: 0.95, lanternIntensityMult: 1.08 },
  palace_marble: { intentHex: '#fef3c7', mix: 0.88, torchIntensityMult: 1.2, lanternIntensityMult: 1.1 },
}

export function getThemeLightIntent(themeId: string | undefined): ThemeLightIntent {
  if (!themeId) return DEFAULT
  return PRESETS[themeId] ?? DEFAULT
}
