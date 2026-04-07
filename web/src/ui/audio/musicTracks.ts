export const MUSIC_TRACKS = {
  dungeon:   '/sounds/music/dungeon_bg_music.mp3',
  safeHaven: '/sounds/music/safe_haven.mp3',
} as const

export type MusicTrackKey = keyof typeof MUSIC_TRACKS

/** Flat list used for preloading all tracks up front. */
export const ALL_MUSIC_TRACKS = Object.values(MUSIC_TRACKS)
