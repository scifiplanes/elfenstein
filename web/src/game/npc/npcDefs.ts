import type { NpcKind } from '../types'

const PLACEHOLDER_NPC = '/content/poi_placeholder.png'

/** Primary in-world / dialog billboard texture per kind. */
export const NPC_SPRITE_SRC: Record<NpcKind, string> = {
  Bobr: '/content/npc_bobr.png',
  Skeleton: '/content/npc_skeleton.png',
  Catoctopus: '/content/npc_catoctopus.png',
  Swarm: PLACEHOLDER_NPC,
  /** In-world art ships as `npc_slime.png`; kind name stays Wurglepup in data. */
  Wurglepup: '/content/npc_slime.png',
  Chumbo: PLACEHOLDER_NPC,
  Grub: PLACEHOLDER_NPC,
  Kuratko: PLACEHOLDER_NPC,
  Grechka: PLACEHOLDER_NPC,
  Snailord: PLACEHOLDER_NPC,
  Bulba: PLACEHOLDER_NPC,
  Elder: PLACEHOLDER_NPC,
  Kerekere: PLACEHOLDER_NPC,
  Bok: PLACEHOLDER_NPC,
  RegularBok: PLACEHOLDER_NPC,
  BigHands: PLACEHOLDER_NPC,
  Gargantula: PLACEHOLDER_NPC,
}

/** Optional second frame swapped on a shared timer (same material per kind). */
export const NPC_SPRITE_IDLE_SRC: Partial<Record<NpcKind, string>> = {
  Catoctopus: '/content/npc_catoctopus_idle.png',
  Skeleton: '/content/npc_skeleton_idle.png',
  Wurglepup: '/content/npc_slime_idle.png',
}
