// Crossfade duration at each loop seam (seconds).
// Long enough to hide the discontinuity; short enough to be inaudible as a fade.
const CROSSFADE_SEC = 0.06

export class MusicPlayer {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private loading = false
  private url: string | null = null
  private loopTimer = 0
  private nextStartTime = 0

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      this.gainNode = this.ctx.createGain()
      this.gainNode.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  async load(url: string) {
    if (this.url === url || this.loading) return
    this.url = url
    this.loading = true
    const ctx = this.ensure()
    try {
      const res = await fetch(url)
      const arrayBuf = await res.arrayBuffer()
      this.buffer = await ctx.decodeAudioData(arrayBuf)
    } finally {
      this.loading = false
    }
    if (this.buffer) this.startLoop()
  }

  private startLoop() {
    if (!this.ctx || !this.gainNode || !this.buffer) return
    window.clearTimeout(this.loopTimer)
    try { this.source?.stop() } catch { /* already stopped */ }
    this.source = null
    this.nextStartTime = this.ctx.currentTime
    this.scheduleNext()
  }

  // Schedules one buffer playback with a fade-in at the start and fade-out at
  // the end, then queues the next iteration to overlap during the fade-out —
  // eliminating the click that AudioBufferSourceNode.loop produces at the seam.
  private scheduleNext() {
    if (!this.ctx || !this.gainNode || !this.buffer) return

    const cf = CROSSFADE_SEC
    const dur = this.buffer.duration
    const startAt = this.nextStartTime

    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer

    // Per-source gain carries the crossfade envelope; master gainNode carries user volume.
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0, startAt)
    g.gain.linearRampToValueAtTime(1, startAt + cf)
    g.gain.setValueAtTime(1, startAt + dur - cf)
    g.gain.linearRampToValueAtTime(0, startAt + dur)

    src.connect(g)
    g.connect(this.gainNode)
    src.start(startAt)
    src.stop(startAt + dur)

    this.source = src
    // Next source starts cf seconds before this one ends so the fades overlap.
    this.nextStartTime = startAt + dur - cf

    const msUntilNext = (this.nextStartTime - this.ctx.currentTime) * 1000
    this.loopTimer = window.setTimeout(() => this.scheduleNext(), Math.max(0, msUntilNext - 100))
  }

  setVolume(volume: number) {
    if (!this.gainNode || !this.ctx) return
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.gainNode.gain.setTargetAtTime(Math.max(0, volume), this.ctx.currentTime, 0.05)
  }

  stop() {
    window.clearTimeout(this.loopTimer)
    try { this.source?.stop() } catch { /* already stopped */ }
    this.source = null
  }
}
