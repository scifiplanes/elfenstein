const AudioCtx =
  window.AudioContext ??
  (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

// Short crossfade at each loop seam to avoid the click from a hard sample jump.
const LOOP_XFADE_SEC = 0.06

type Track = {
  buffer: AudioBuffer
  /** Per-track gain — ramped for crossfades between tracks. */
  masterGain: GainNode
  /** setTimeout handle for the loop scheduler. */
  loopTimer: number
  nextStartTime: number
}

export class MusicPlayer {
  private ctx: AudioContext | null = null
  /** Single output gain node — driven by setVolume(). */
  private outputGain: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private activeTracks = new Map<string, Track>()
  private currentUrl: string | null = null

  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioCtx()
      this.outputGain = this.ctx.createGain()
      this.outputGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  async preload(urls: string[]) {
    const ctx = this.ensure()
    await Promise.all(
      urls.map(async (url) => {
        if (this.buffers.has(url)) return
        const res = await fetch(url)
        const arr = await res.arrayBuffer()
        this.buffers.set(url, await ctx.decodeAudioData(arr))
      }),
    )
  }

  /**
   * Cross-fade from the currently playing track to `url` over `durationSec` seconds.
   * Pass `durationSec = 0` for an instant switch. No-ops if `url` is already active.
   */
  crossfadeTo(url: string, durationSec = 2) {
    if (this.currentUrl === url) return
    const buffer = this.buffers.get(url)
    if (!buffer) return // not preloaded yet — caller should await preload first

    const ctx = this.ensure()
    const now = ctx.currentTime

    // Fade out every currently active track.
    for (const [activeUrl, track] of this.activeTracks) {
      if (activeUrl === url) continue
      if (durationSec > 0) {
        track.masterGain.gain.setValueAtTime(track.masterGain.gain.value, now)
        track.masterGain.gain.linearRampToValueAtTime(0, now + durationSec)
      } else {
        track.masterGain.gain.setValueAtTime(0, now)
      }
      const urlToStop = activeUrl
      window.setTimeout(() => this.stopTrack(urlToStop), durationSec * 1000 + 300)
    }

    // Start the new track with its master gain at 0, then ramp to 1.
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, now)
    if (durationSec > 0) {
      masterGain.gain.linearRampToValueAtTime(1, now + durationSec)
    } else {
      masterGain.gain.setValueAtTime(1, now)
    }
    masterGain.connect(this.outputGain!)

    const track: Track = { buffer, masterGain, loopTimer: 0, nextStartTime: now }
    this.activeTracks.set(url, track)
    this.currentUrl = url
    this.scheduleNext(url)
  }

  // Schedules overlapping buffer sources at the loop seam to avoid clicks.
  private scheduleNext(url: string) {
    const track = this.activeTracks.get(url)
    if (!track || !this.ctx) return

    const cf = LOOP_XFADE_SEC
    const dur = track.buffer.duration
    const startAt = track.nextStartTime

    const src = this.ctx.createBufferSource()
    src.buffer = track.buffer

    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, startAt)
    g.gain.linearRampToValueAtTime(1, startAt + cf)
    g.gain.setValueAtTime(1, startAt + dur - cf)
    g.gain.linearRampToValueAtTime(0, startAt + dur)

    src.connect(g)
    g.connect(track.masterGain)
    src.start(startAt)
    src.stop(startAt + dur)

    track.nextStartTime = startAt + dur - cf
    const msUntilNext = (track.nextStartTime - this.ctx.currentTime) * 1000
    track.loopTimer = window.setTimeout(
      () => this.scheduleNext(url),
      Math.max(0, msUntilNext - 100),
    )
  }

  private stopTrack(url: string) {
    const track = this.activeTracks.get(url)
    if (!track) return
    window.clearTimeout(track.loopTimer)
    track.masterGain.disconnect()
    this.activeTracks.delete(url)
    if (this.currentUrl === url) this.currentUrl = null
  }

  setVolume(volume: number) {
    if (!this.outputGain || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.outputGain.gain.setTargetAtTime(Math.max(0, volume), this.ctx.currentTime, 0.05)
  }

  stop() {
    for (const url of [...this.activeTracks.keys()]) this.stopTrack(url)
    this.currentUrl = null
  }
}
