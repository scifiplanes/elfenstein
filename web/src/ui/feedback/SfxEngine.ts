export type SfxKind = 'ui' | 'hit' | 'swing' | 'reject' | 'pickup' | 'munch' | 'step' | 'bump' | 'nav' | 'bones' | 'well'
type SfxTuning = {
  masterSfx: number
  munchVol: number
  munchCutoffHz: number
  munchCutoffEndHz: number
  munchHighpassHz: number
  munchHighpassQ: number
  munchLowpassQ: number
  munchDurSec: number
  munchThumpHz: number
  munchTremDepth: number
  munchTremHz: number
}

export class SfxEngine {
  private ctx: AudioContext | null = null

  play(kind: SfxKind, tuning?: Partial<SfxTuning>) {
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
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

        // Short “munch”: bandpassed noise + a low thump (thump bypasses HP so the jaw hit stays felt).
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, now)
        g.gain.exponentialRampToValueAtTime(0.06 * masterSfx * munchVol, now + 0.008)
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur)

        const fStart = Math.max(80, cutoffHz)
        const fEnd = Math.max(80, cutoffEndHz)
        const lpMin = Math.min(fStart, fEnd)
        const hpDerived = Math.max(80, Math.min(lpMin * 0.42, lpMin * 0.75))
        const hpTuned = tuning?.munchHighpassHz ?? hpDerived
        const hpFreq = Math.max(80, Math.min(hpTuned, lpMin * 0.98))
        const hpQ = Math.max(0.1, Math.min(18, tuning?.munchHighpassQ ?? 0.707))
        const lpQ = Math.max(0.1, Math.min(18, tuning?.munchLowpassQ ?? 0.8))

        const hp = ctx.createBiquadFilter()
        hp.type = 'highpass'
        hp.frequency.setValueAtTime(hpFreq, now)
        hp.Q.setValueAtTime(hpQ, now)

        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.setValueAtTime(fStart, now)
        lp.frequency.exponentialRampToValueAtTime(fEnd, now + Math.min(dur, 0.2))
        lp.Q.setValueAtTime(lpQ, now)

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

        noise.connect(hp)
        hp.connect(lp)
        lp.connect(g)
        o.connect(og)
        og.connect(g)

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
        const masterSfx = tuning?.masterSfx ?? 1

        let base: number
        let vol: number
        if (kind === 'step') {
          // Soft low thud for on-screen button presses — step-like but quieter.
          o.type = 'sine'
          base = 80
          vol = 0.045 * masterSfx
          o.frequency.setValueAtTime(base, now)
          o.frequency.exponentialRampToValueAtTime(base * 0.65, now + 0.08)
          g.gain.setValueAtTime(0.0001, now)
          g.gain.exponentialRampToValueAtTime(vol, now + 0.01)
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
          o.connect(g)
          g.connect(ctx.destination)
          o.start(now)
          o.stop(now + 0.13)
        } else if (kind === 'bump') {
          o.type = 'sawtooth'
          base = 95
          vol = 0.055 * masterSfx
        } else {
          o.type = kind === 'reject' ? 'sawtooth' : 'triangle'
          base =
            kind === 'hit' ? 120
            : kind === 'swing' ? 220
            : kind === 'pickup' ? 520
            : kind === 'reject' ? 160
            : 420
          vol =
            (kind === 'hit' ? 0.08
            : kind === 'swing' ? 0.045
            : kind === 'reject' ? 0.06
            : 0.04) * masterSfx
        }
        o.frequency.setValueAtTime(base, now)
        o.frequency.exponentialRampToValueAtTime(base * 0.75, now + 0.08)
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

