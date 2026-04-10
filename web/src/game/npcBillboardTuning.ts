import type { NpcBillboardByKind, NpcKind } from './types'

const row = (groundY = 0, size = 0.65, sizeRand = 0) => ({ groundY, size, sizeRand })

/** Baseline billboard pivot/size for every `NpcKind` (F2 can override per kind). */
export const DEFAULT_NPC_BILLBOARD: NpcBillboardByKind = {
  Wurglepup: row(),
  Bobr: row(),
  Skeleton: row(),
  Catoctopus: row(),
  Swarm: row(),
  Chumbo: row(),
  Grub: row(),
  Kuratko: row(),
  Grechka: row(),
  Snailord: row(),
  Bulba: row(),
  Elder: row(),
  Kerekere: row(),
  Bok: row(),
  RegularBok: row(),
  BigHands: row(),
  Gargantula: row(),
}

/** Pre-`npcBillboard` debug JSON used flat keys for four kinds; still merged on load. */
export const LEGACY_NPC_FLAT_KEYS = [
  'npcGroundY_Wurglepup',
  'npcGroundY_Bobr',
  'npcGroundY_Skeleton',
  'npcGroundY_Catoctopus',
  'npcSize_Wurglepup',
  'npcSizeRand_Wurglepup',
  'npcSize_Bobr',
  'npcSizeRand_Bobr',
  'npcSize_Skeleton',
  'npcSizeRand_Skeleton',
  'npcSize_Catoctopus',
  'npcSizeRand_Catoctopus',
] as const

export type LegacyNpcRenderFlat = Partial<{
  npcGroundY_Wurglepup: number
  npcGroundY_Bobr: number
  npcGroundY_Skeleton: number
  npcGroundY_Catoctopus: number
  npcSize_Wurglepup: number
  npcSizeRand_Wurglepup: number
  npcSize_Bobr: number
  npcSizeRand_Bobr: number
  npcSize_Skeleton: number
  npcSizeRand_Skeleton: number
  npcSize_Catoctopus: number
  npcSizeRand_Catoctopus: number
}>

export function buildNpcBillboardFromInput(
  input: { npcBillboard?: Partial<NpcBillboardByKind> } & LegacyNpcRenderFlat,
): NpcBillboardByKind {
  const out: NpcBillboardByKind = { ...DEFAULT_NPC_BILLBOARD }
  const kinds = Object.keys(out) as NpcKind[]
  if (input.npcBillboard) {
    for (const k of kinds) {
      const patch = input.npcBillboard[k]
      if (patch) out[k] = { ...out[k], ...patch }
    }
  }
  if (input.npcGroundY_Wurglepup !== undefined) out.Wurglepup = { ...out.Wurglepup, groundY: input.npcGroundY_Wurglepup }
  if (input.npcGroundY_Bobr !== undefined) out.Bobr = { ...out.Bobr, groundY: input.npcGroundY_Bobr }
  if (input.npcGroundY_Skeleton !== undefined) out.Skeleton = { ...out.Skeleton, groundY: input.npcGroundY_Skeleton }
  if (input.npcGroundY_Catoctopus !== undefined) out.Catoctopus = { ...out.Catoctopus, groundY: input.npcGroundY_Catoctopus }
  if (input.npcSize_Wurglepup !== undefined) out.Wurglepup = { ...out.Wurglepup, size: input.npcSize_Wurglepup }
  if (input.npcSizeRand_Wurglepup !== undefined) out.Wurglepup = { ...out.Wurglepup, sizeRand: input.npcSizeRand_Wurglepup }
  if (input.npcSize_Bobr !== undefined) out.Bobr = { ...out.Bobr, size: input.npcSize_Bobr }
  if (input.npcSizeRand_Bobr !== undefined) out.Bobr = { ...out.Bobr, sizeRand: input.npcSizeRand_Bobr }
  if (input.npcSize_Skeleton !== undefined) out.Skeleton = { ...out.Skeleton, size: input.npcSize_Skeleton }
  if (input.npcSizeRand_Skeleton !== undefined) out.Skeleton = { ...out.Skeleton, sizeRand: input.npcSizeRand_Skeleton }
  if (input.npcSize_Catoctopus !== undefined) out.Catoctopus = { ...out.Catoctopus, size: input.npcSize_Catoctopus }
  if (input.npcSizeRand_Catoctopus !== undefined) out.Catoctopus = { ...out.Catoctopus, sizeRand: input.npcSizeRand_Catoctopus }
  return out
}

export function clampNpcBillboardRows(b: NpcBillboardByKind): NpcBillboardByKind {
  const clampGroundY = (v: number) => Math.max(-0.75, Math.min(1.25, Number(v)))
  const clampSize = (v: number) => Math.max(0.1, Math.min(2.5, Number(v)))
  const clampRand = (v: number) => Math.max(0, Math.min(1, Number(v)))
  const kinds = Object.keys(b) as NpcKind[]
  const next = { ...b }
  for (const k of kinds) {
    const r = b[k]
    next[k] = {
      groundY: clampGroundY(r.groundY),
      size: clampSize(r.size),
      sizeRand: clampRand(r.sizeRand),
    }
  }
  return next
}
