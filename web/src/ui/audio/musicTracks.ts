export const MUSIC_TRACKS = {
  dungeon:   '/sounds/music/dungeon_bg_music.mp3',
  dungeon1:  '/sounds/music/dungeon_bg_music_1.mp3',
  safeHaven: '/sounds/music/safe_haven.mp3',
} as const

export type MusicSet = {
  /** Stable id — used to detect when the active set changes. */
  id: string
  /** Ordered variation URLs; rotated in sequence. */
  tracks: string[]
  /** Each variation plays a random number of times in [playsMin, playsMax] before rotating. */
  playsMin: number
  playsMax: number
}

export const MUSIC_SETS = {
  dungeon: {
    id: 'dungeon',
    tracks: [MUSIC_TRACKS.dungeon, MUSIC_TRACKS.dungeon1],
    playsMin: 1,
    playsMax: 3,
  },
  safeHaven: {
    id: 'safeHaven',
    tracks: [MUSIC_TRACKS.safeHaven],
    playsMin: 1,
    playsMax: 1,
  },
} satisfies Record<string, MusicSet>

/** Flat list of every URL — used to preload all tracks up front. */
export const ALL_MUSIC_TRACKS = Object.values(MUSIC_TRACKS)
