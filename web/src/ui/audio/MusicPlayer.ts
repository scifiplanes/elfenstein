export class MusicPlayer {
  private ctx: AudioContext | null = null
  private gainNode: GainNode | null = null
  private source: AudioBufferSourceNode | null = null
  private buffer: AudioBuffer | null = null
  private loading = false
  private url: string | null = null

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
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
    this.source?.stop()
    this.source?.disconnect()
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffer
    src.loop = true
    src.connect(this.gainNode)
    src.start()
    this.source = src
  }

  setVolume(volume: number) {
    if (!this.gainNode || !this.ctx) return
    // Retry resume in case the context was suspended at load time (browser autoplay policy).
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.gainNode.gain.setTargetAtTime(Math.max(0, volume), this.ctx.currentTime, 0.05)
  }

  stop() {
    this.source?.stop()
    this.source = null
  }
}
