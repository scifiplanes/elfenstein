import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { GameState } from '../../game/types'
import { MusicPlayer } from './MusicPlayer'
import { SfxFilePlayer } from './SfxFilePlayer'
import { ALL_MUSIC_TRACKS, BG_SFX_TRACKS, PROXIMITY_OVERLAYS } from './musicTracks'
import { selectBgTrack, selectOverlays } from './musicRules'

/** Crossfade duration when the floor type changes and a new bg loop starts. */
const BG_XFADE_SEC = 2.5
/**
 * Smoothing time constant (seconds) for overlay volume changes.
 * `setTargetAtTime` reaches ~95% of the target after 3× this value,
 * so 0.6 → ~1.8s to fully fade in/out across a step change.
 */
const OVERLAY_VOL_TAU = 0.6
/** Random sfx plays every [MIN, MAX] seconds. */
const BG_SFX_MIN_SEC = 60
const BG_SFX_MAX_SEC = 120

export function MusicLayer(props: { state: GameState }) {
  const { state } = props

  const bgPlayer  = useMemo(() => new MusicPlayer(), [])
  const sfxPlayer = useMemo(() => new SfxFilePlayer(), [])

  /**
   * One MusicPlayer per unique overlay track, created once on mount.
   * Keyed by track URL so lookups in the per-frame effect are O(1).
   */
  const overlayPlayers = useMemo(() => {
    const map = new Map<string, MusicPlayer>()
    for (const overlay of PROXIMITY_OVERLAYS) {
      if (!map.has(overlay.track)) map.set(overlay.track, new MusicPlayer())
    }
    return map
  }, [])

  /** Track URL that is currently playing (or being crossfaded to). */
  const activeBgTrackRef  = useRef<string | null>(null)
  const sfxTimerRef       = useRef<number>(0)
  /** Latest masterMusic value — read inside the sfx setTimeout callback. */
  const masterMusicRef    = useRef(state.audio.masterMusic)
  /** Last debugBgSfxTrigger seq we acted on — detects new triggers. */
  const lastSfxSeqRef     = useRef(-1)

  // ── Mount / unmount ─────────────────────────────────────────────────────────
  useEffect(() => {
    const autoplayTimers: number[] = []

    const resume = () => {
      bgPlayer.ensure()
      for (const p of overlayPlayers.values()) p.ensure()
    }
    window.addEventListener('pointerdown', resume)
    window.addEventListener('keydown', resume)

    // Each MusicPlayer has its own buffer map, so each must preload its own tracks.
    const overlayPreloads = Array.from(overlayPlayers.entries()).map(([track, player]) =>
      player.preload([track]),
    )
    // Attempt to unlock all AudioContexts. Browsers that allow autoplay (Firefox,
    // Chrome on localhost / high-engagement origins) will succeed immediately.
    // Strict browsers ignore these calls until a real user gesture fires; the
    // pointerdown/keydown listeners above serve as the guaranteed fallback.
    const tryResume = () => {
      bgPlayer.ensure()
      for (const p of overlayPlayers.values()) p.ensure()
    }

    void Promise.all([bgPlayer.preload(ALL_MUSIC_TRACKS), ...overlayPreloads]).then(() => {
      for (const [track, player] of overlayPlayers) {
        player.crossfadeTo(track, 0)
        player.setVolumeImmediate(0)
      }
      const track = activeBgTrackRef.current
      if (track) bgPlayer.crossfadeTo(track, 0)

      // Try to start playback immediately, then retry a couple of times in case
      // the browser's autoplay permission resolves slightly after page load.
      tryResume()
      const t1 = window.setTimeout(tryResume, 500)
      const t2 = window.setTimeout(tryResume, 2000)
      // Store timers so they can be cleared on unmount (assigned via closure below).
      autoplayTimers.push(t1, t2)
    })

    void sfxPlayer.load(BG_SFX_TRACKS)

    const scheduleSfx = () => {
      const delaySec = BG_SFX_MIN_SEC + Math.random() * (BG_SFX_MAX_SEC - BG_SFX_MIN_SEC)
      sfxTimerRef.current = window.setTimeout(() => {
        sfxPlayer.play(masterMusicRef.current)
        scheduleSfx()
      }, delaySec * 1000)
    }
    scheduleSfx()

    return () => {
      bgPlayer.stop()
      for (const p of overlayPlayers.values()) p.stop()
      window.clearTimeout(sfxTimerRef.current)
      for (const t of autoplayTimers) window.clearTimeout(t)
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
    }
  }, [bgPlayer, overlayPlayers, sfxPlayer])

  // ── Keep masterMusicRef in sync before effects run (avoids stale closure in sfx timer). ──
  useLayoutEffect(() => {
    masterMusicRef.current = state.audio.masterMusic
  })

  // ── Master volume ────────────────────────────────────────────────────────────
  useEffect(() => {
    bgPlayer.setVolume(state.audio.masterMusic)
  }, [bgPlayer, state.audio.masterMusic])

  // ── Bg track selection (floor type or debug override) ────────────────────────
  // Debug override only applies in-game; title screen always uses the theme.
  const desiredBgTrack =
    state.ui.screen !== 'title' && state.ui.debugBgTrack
      ? state.ui.debugBgTrack
      : selectBgTrack(state)
  useEffect(() => {
    if (activeBgTrackRef.current !== desiredBgTrack) {
      const isFirst = activeBgTrackRef.current === null
      activeBgTrackRef.current = desiredBgTrack
      bgPlayer.crossfadeTo(desiredBgTrack, isFirst ? 0 : BG_XFADE_SEC)
    }
  })

  // ── Debug bg sfx trigger ─────────────────────────────────────────────────────
  const debugTrigger = state.ui.debugBgSfxTrigger
  useEffect(() => {
    if (debugTrigger && debugTrigger.seq !== lastSfxSeqRef.current) {
      lastSfxSeqRef.current = debugTrigger.seq
      sfxPlayer.playAt(debugTrigger.index, masterMusicRef.current)
    }
  })

  // ── Overlay volumes (distance-based, updated every render) ───────────────────
  const overlays = selectOverlays(state)
  const masterMusic = state.audio.masterMusic
  useEffect(() => {
    for (const { track, volume } of overlays) {
      overlayPlayers.get(track)?.setVolume(volume * masterMusic, OVERLAY_VOL_TAU)
    }
  })

  return null
}
