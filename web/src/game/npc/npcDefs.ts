import type { NpcKind } from '../types'

/**
 * 3D world uses emoji billboards (canvas texture) instead of `NPC_SPRITE_SRC` for these kinds until bespoke sprites ship.
 * Glyphs are chosen for quick silhouette reads at billboard scale.
 */
export const NPC_WORLD_EMOJI_PLACEHOLDER: Partial<Record<NpcKind, string>> = {
  BigHands: '🙌',
  Bok: '🪬',
  RegularBok: '🧿',
  Swarm: '🦟',
  Gargantula: '🕷️',
  Grechka: '🐞',
  Bulba: '🐝',
  Kerekere: '🪰',
}

export function getNpcWorldEmojiPlaceholder(kind: NpcKind): string | null {
  return NPC_WORLD_EMOJI_PLACEHOLDER[kind] ?? null
}

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
  /** Same sprites as `Grub`; tint in `NPC_SPRITE_TINT_HEX` / `WorldRenderer`. */
  SporeGrub: '/content/npc_grub.png',
  SunGrub: '/content/npc_grub.png',
  Kuratko: '/content/npc_kuratko.png',
  Grechka: '/content/npc_grechka.png',
  Snailord: '/content/npc_snailord.png',
  Bulba: '/content/npc_bulba.png',
  /** In-world Elder uses a procedural shader billboard in `WorldRenderer`; PNG kept for parity / tooling. */
  Elder: '/content/npc_elder.png',
  Kerekere: '/content/npc_kerekere.png',
  Bok: '/content/npc_bok.png',
  RegularBok: '/content/npc_regular_bok.png',
  BigHands: '/content/npc_big_hands.png',
  Gargantula: '/content/npc_gargantula.png',
}

/**
 * Multiply tint on `MeshLambertMaterial.color` for sprite NPC billboards (0xRRGGBB).
 * Omitted kinds use white (no tint). Not full CSS hue-rotate; tuned for silhouette read.
 */
export const NPC_SPRITE_TINT_HEX: Partial<Record<NpcKind, number>> = {
  SporeGrub: 0xb8a0e8,
  SunGrub: 0xf5c878,
}

/** Optional second frame swapped on a shared timer (same material per kind). */
export const NPC_SPRITE_IDLE_SRC: Partial<Record<NpcKind, string>> = {
  Bobr: '/content/npc_bobr_idle.png',
  Catoctopus: '/content/npc_catoctopus_idle.png',
  Skeleton: '/content/npc_skeleton_idle.png',
  Wurglepup: '/content/npc_slime_idle.png',
  Chumbo: '/content/npc_chumbo_idle.png',
  Grub: '/content/npc_grub_idle.png',
  SporeGrub: '/content/npc_grub_idle.png',
  SunGrub: '/content/npc_grub_idle.png',
  Kuratko: '/content/npc_kuratko_idle.png',
  Snailord: '/content/npc_snailord_idle.png',
}
