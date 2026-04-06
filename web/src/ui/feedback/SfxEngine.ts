type SfxKind = 'ui' | 'hit' | 'reject' | 'pickup' | 'munch'
type SfxTuning = {
  masterSfx: number
  munchVol: number
  munchCutoffHz: number
  munchCutoffEndHz: number
  munchDurSec: number
  munchThumpHz: number
  munchTremDepth: number
  munchTremHz: number
}

export class SfxEngine {
  private ctx: AudioContext | null = null

  play(kind: SfxKind, tuning?: Partial<SfxTuning>) {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const ctx = this.ctx
      if (ctx.state === 'suspended') void ctx.resume()

      const now = ctx.currentTime
      if (kind === 'munch') {
        const masterSfx = tuning?.masterSfx ?? 1
        const munchVol = tuning?.munchVol ?? 1
        const cutoffHz = tuning?.munchCutoffHz ?? 900
        const cutoffEndHz = tuning?.munchCutoffEndHz ?? 420
        const dur = Math.max(0.04, Math.min(0.6, tuning?.munchDurSec ?? 0.18))
        const thumpHz = Math.max(30, Math.min(220, tuning?.munchThumpHz ?? 90))
        const tremDepth = Math.max(0, Math.min(1, tuning?.munchTremDepth ?? 0.35))
        const tremHz = Math.max(0.5, Math.min(60, tuning?.munchTremHz ?? 18))

        // Short “munch” made from filtered noise + a low thump.
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(0.06 * masterSfx * munchVol, now + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur)

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(Math.max(80, cutoffHz), now)
        filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoffEndHz), now + Math.min(dur, 0.2))
        filter.Q.setValueAtTime(0.8, now)

        const noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate)
        const data = noiseBuf.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.55
        const noise = ctx.createBufferSource()
        noise.buffer = noiseBuf

        const o = ctx.createOscillator()
        o.type = 'sine'
        o.frequency.setValueAtTime(thumpHz, now)
        o.frequency.exponentialRampToValueAtTime(thumpHz * 0.78, now + Math.min(dur, 0.2))
        const og = ctx.createGain()
        og.gain.setValueAtTime(0.0001, now)
        og.gain.exponentialRampToValueAtTime(0.05 * masterSfx * munchVol, now + 0.006)
        og.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(dur, 0.11))

        noise.connect(filter)
        o.connect(og)
        og.connect(filter)
        filter.connect(g)

        // Square LFO tremolo on the final output gain:
        // gain(t) = env(t) * (1 - depth + depth * square(t)) where square∈{0,1}
        if (tremDepth > 0) {
          const lfo = ctx.createOscillator()
          lfo.type = 'square'
          lfo.frequency.setValueAtTime(tremHz, now)
          const lfoGain = ctx.createGain()
          // square output is [-1, +1] -> scale to [0, 1]
          lfoGain.gain.setValueAtTime(0.5, now)
          lfo.connect(lfoGain)

          const lfoOffset = ctx.createConstantSource()
          lfoOffset.offset.setValueAtTime(0.5, now)

          const trem = ctx.createGain()
          trem.gain.setValueAtTime(tremDepth, now)

          const base = ctx.createConstantSource()
          base.offset.setValueAtTime(1 - tremDepth, now)

          lfoGain.connect(trem)
          lfoOffset.connect(trem)

          const tremSum = ctx.createGain()
          base.connect(tremSum)
          trem.connect(tremSum)

          tremSum.connect(g.gain)

          lfo.start(now)
          lfo.stop(now + dur)
          lfoOffset.start(now)
          lfoOffset.stop(now + dur)
          base.start(now)
          base.stop(now + dur)
        }

        g.connect(ctx.destination)

        noise.start(now)
        noise.stop(now + dur)
        o.start(now)
        o.stop(now + dur)
      } else {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = kind === 'reject' ? 'sawtooth' : 'triangle'

        const base = kind === 'hit' ? 120 : kind === 'pickup' ? 520 : kind === 'reject' ? 160 : 420
        o.frequency.setValueAtTime(base, now)
        o.frequency.exponentialRampToValueAtTime(base * 0.75, now + 0.08)

        const masterSfx = tuning?.masterSfx ?? 1
        const vol = (kind === 'hit' ? 0.08 : kind === 'reject' ? 0.06 : 0.04) * masterSfx
        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(vol, now + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

        o.connect(g)
        g.connect(ctx.destination)
        o.start(now)
        o.stop(now + 0.13)
      }
    } catch {
      // ignore audio failures
    }
  }
}

