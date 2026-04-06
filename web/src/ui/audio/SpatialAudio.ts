export type Emitter = {
  id: string
  pos: { x: number; y: number } // grid coords
  kind: 'poi' | 'npc'
}

export type SpatialAudioTuning = {
  master: number // 0..1
  minCutoffHz: number
  maxCutoffHz: number
  minGain: number // 0..1
  maxGain: number // 0..1
  maxDistance: number // cells
}

type NodeBundle = {
  osc: OscillatorNode
  gain: GainNode
  filter: BiquadFilterNode
}

export class SpatialAudio {
  private ctx: AudioContext | null = null
  private nodes = new Map<string, NodeBundle>()

  ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setEmitters(emitters: Emitter[], listener: { x: number; y: number }, t: SpatialAudioTuning) {
    const ctx = this.ensure()

    const wanted = new Set(emitters.map((e) => e.id))
    for (const id of this.nodes.keys()) {
      if (!wanted.has(id)) {
        this.nodes.get(id)!.osc.stop()
        this.nodes.get(id)!.osc.disconnect()
        this.nodes.get(id)!.gain.disconnect()
        this.nodes.get(id)!.filter.disconnect()
        this.nodes.delete(id)
      }
    }

    for (const e of emitters) {
      let b = this.nodes.get(e.id)
      if (!b) {
        const osc = ctx.createOscillator()
        osc.type = e.kind === 'poi' ? 'sine' : 'triangle'
        osc.frequency.value = e.kind === 'poi' ? 220 : 140

        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.Q.value = 0.7

        const gain = ctx.createGain()
        gain.gain.value = 0

        osc.connect(filter)
        filter.connect(gain)
        gain.connect(ctx.destination)
        osc.start()

        b = { osc, filter, gain }
        this.nodes.set(e.id, b)
      }

      const d = manhattan(listener, e.pos)
      const distN = clamp01(d / Math.max(1e-6, t.maxDistance))
      const gainV = lerp(t.maxGain, t.minGain, distN) * t.master
      const cutoff = lerp(t.maxCutoffHz, t.minCutoffHz, distN)

      const now = ctx.currentTime
      b.gain.gain.setTargetAtTime(gainV, now, 0.05)
      b.filter.frequency.setTargetAtTime(cutoff, now, 0.05)
    }
  }
}

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x))
}

