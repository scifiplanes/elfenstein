import type { StatusEffectDef } from './contentDb'

export const DEFAULT_STATUSES: StatusEffectDef[] = [
  { id: 'Poisoned', name: 'Poisoned', kind: 'negative', defaultDurationMs: 30_000 },
  { id: 'Blessed', name: 'Blessed', kind: 'positive', defaultDurationMs: 45_000 },
  { id: 'Sick', name: 'Sick', kind: 'negative', defaultDurationMs: 30_000 },
  { id: 'Bleeding', name: 'Bleeding', kind: 'negative', defaultDurationMs: 25_000 },
  { id: 'Burning', name: 'Burning', kind: 'negative', defaultDurationMs: 12_000 },
  { id: 'Drenched', name: 'Drenched', kind: 'neutral', defaultDurationMs: 12_000 },
  { id: 'Drowsy', name: 'Drowsy', kind: 'negative', defaultDurationMs: 18_000 },
  { id: 'Focused', name: 'Focused', kind: 'positive', defaultDurationMs: 20_000 },
  { id: 'Cursed', name: 'Cursed', kind: 'negative' },
  { id: 'Frightened', name: 'Frightened', kind: 'negative', defaultDurationMs: 14_000 },
  { id: 'Rooted', name: 'Rooted', kind: 'negative', defaultDurationMs: 7_000 },
  { id: 'Shielded', name: 'Shielded', kind: 'positive', defaultDurationMs: 12_000 },
  { id: 'Starving', name: 'Starving', kind: 'negative' },
  { id: 'Dehydrated', name: 'Dehydrated', kind: 'negative' },
  { id: 'NanoTagged', name: 'Nano-tagged', kind: 'negative', defaultDurationMs: 25_000 },
  { id: 'Spored', name: 'Spored', kind: 'negative', defaultDurationMs: 22_000 },
  { id: 'Parasitized', name: 'Parasitized', kind: 'negative', defaultDurationMs: 28_000 },
]

