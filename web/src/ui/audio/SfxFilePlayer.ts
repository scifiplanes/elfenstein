const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext

/** Loads one or more audio files and plays a random one on each call to play(). */
export class SfxFilePlayer {
  private ctx: AudioContext | null = null
  private buffers: AudioBuffer[] = []

  private ensure() {
    if (!this.ctx) this.ctx = new AudioCtx()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  async load(urls: string[]) {
    const ctx = this.ensure()
    this.buffers = await Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url)
        const arrayBuf = await res.arrayBuffer()
        return ctx.decodeAudioData(arrayBuf)
      }),
    )
  }

  play(volume = 1) {
    if (!this.buffers.length) return
    const ctx = this.ensure()
    const buffer = this.buffers[Math.floor(Math.random() * this.buffers.length)]

    const src = ctx.createBufferSource()
    src.buffer = buffer

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.max(0, volume), ctx.currentTime)

    src.connect(gain)
    gain.connect(ctx.destination)
    src.start()
    // No need to stop — the source auto-disconnects when the buffer finishes.
  }
}
