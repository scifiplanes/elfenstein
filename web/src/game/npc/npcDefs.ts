import type { NpcKind } from '../types'

/** Primary in-world / dialog billboard texture per kind. */
export const NPC_SPRITE_SRC: Record<NpcKind, string> = {
  Bobr: '/content/npc_bobr.png',
  Skeleton: '/content/npc_skeleton.png',
  Catoctopus: '/content/npc_catoctopus.png',
  Swarm: '/content/npc_swarm.png',
  /** In-world art ships as `npc_slime.png`; kind name stays Wurglepup in data. */
  Wurglepup: '/content/npc_slime.png',
  Chumbo: '/content/npc_chumbo.png',
  Grub: '/content/npc_grub.png',
  Kuratko: '/content/npc_kuratko.png',
  Grechka: '/content/npc_grechka.png',
  Snailord: '/content/npc_snailord.png',
  Bulba: '/content/npc_bulba.png',
  Elder: '/content/npc_elder.png',
  Kerekere: '/content/npc_kerekere.png',
  Bok: '/content/npc_bok.png',
  RegularBok: '/content/npc_regular_bok.png',
  BigHands: '/content/npc_big_hands.png',
  Gargantula: '/content/npc_gargantula.png',
}

/** Optional second frame swapped on a shared timer (same material per kind). */
export const NPC_SPRITE_IDLE_SRC: Partial<Record<NpcKind, string>> = {
  Bobr: '/content/npc_bobr_idle.png',
  Catoctopus: '/content/npc_catoctopus_idle.png',
  Skeleton: '/content/npc_skeleton_idle.png',
  Wurglepup: '/content/npc_slime_idle.png',
  Chumbo: '/content/npc_chumbo_idle.png',
  Grub: '/content/npc_grub_idle.png',
  Kuratko: '/content/npc_kuratko_idle.png',
  Snailord: '/content/npc_snailord_idle.png',
}
