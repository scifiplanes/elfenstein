import * as THREE from 'three'
import type { FloorType } from '../procgen/types'

/** `FloorType`s that use small CPU-generated **DataTexture** albedos instead of PNG triples. */
const PROCEDURAL_ENV_TYPES = ['Bunker', 'Golem', 'Catacombs', 'Palace', 'LivingBio'] as const

export type ProceduralDungeonEnvFloorType = (typeof PROCEDURAL_ENV_TYPES)[number]

export function isProceduralDungeonEnvFloorType(ft: FloorType): ft is ProceduralDungeonEnvFloorType {
  return (PROCEDURAL_ENV_TYPES as readonly string[]).includes(ft)
}

function mul(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable seeds per theme so procgen / regen does not reshuffle albedo identity. */
function seedsForFloorType(ft: ProceduralDungeonEnvFloorType): { sf: number; sw: number; sc: number } {
  switch (ft) {
    case 'Bunker':
      return { sf: 0x51a7_00d1, sw: 0x51a7_00d2, sc: 0x51a7_00d3 }
    case 'Golem':
      return { sf: 0x60e1_00d1, sw: 0x60e1_00d2, sc: 0x60e1_00d3 }
    case 'Catacombs':
      return { sf: 0xca7a_00d1, sw: 0xca7a_00d2, sc: 0xca7a_00d3 }
    case 'Palace':
      return { sf: 0x9a1a_00d1, sw: 0x9a1a_00d2, sc: 0x9a1a_00d3 }
    case 'LivingBio':
      return { sf: 0x11fe_00d1, sw: 0x11fe_00d2, sc: 0x11fe_00d3 }
  }
}

type Tint = { fr: number; fg: number; fb: number; wr: number; wg: number; wb: number; cr: number; cg: number; cb: number }

function tintFor(ft: ProceduralDungeonEnvFloorType): Tint {
  switch (ft) {
    case 'Bunker':
      return { fr: 0.9, fg: 0.95, fb: 1.08, wr: 0.85, wg: 0.9, wb: 1.05, cr: 0.75, cg: 0.8, cb: 0.95 }
    case 'Golem':
      return { fr: 1.05, fg: 0.98, fb: 0.88, wr: 1.08, wg: 0.95, wb: 0.82, cr: 0.95, cg: 0.88, cb: 0.78 }
    case 'Catacombs':
      return { fr: 0.95, fg: 0.88, fb: 1.05, wr: 0.92, wg: 0.85, wb: 1.02, cr: 0.82, cg: 0.78, cb: 0.95 }
    case 'Palace':
      return { fr: 1.08, fg: 1.02, fb: 0.92, wr: 1.02, wg: 0.98, wb: 0.9, cr: 0.95, cg: 0.92, cb: 0.85 }
    case 'LivingBio':
      return { fr: 0.88, fg: 1.05, fb: 0.92, wr: 0.82, wg: 1.02, wb: 0.88, cr: 0.7, cg: 0.85, cb: 0.72 }
  }
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.floor(n)))
}

function putF(data: Uint8Array, w: number, x: number, y: number, g: number, tint: Pick<Tint, 'fr' | 'fg' | 'fb'>) {
  const o = (y * w + x) * 4
  data[o] = clampByte(g * tint.fr)
  data[o + 1] = clampByte(g * tint.fg)
  data[o + 2] = clampByte(g * tint.fb)
  data[o + 3] = 255
}

function putW(data: Uint8Array, w: number, x: number, y: number, g: number, tint: Pick<Tint, 'wr' | 'wg' | 'wb'>) {
  const o = (y * w + x) * 4
  data[o] = clampByte(g * tint.wr)
  data[o + 1] = clampByte(g * tint.wg)
  data[o + 2] = clampByte(g * tint.wb)
  data[o + 3] = 255
}

function putC(data: Uint8Array, w: number, x: number, y: number, g: number, tint: Pick<Tint, 'cr' | 'cg' | 'cb'>) {
  const o = (y * w + x) * 4
  data[o] = clampByte(g * tint.cr)
  data[o + 1] = clampByte(g * tint.cg)
  data[o + 2] = clampByte(g * tint.cb)
  data[o + 3] = 255
}

/** Metal deck: horizontal wear strips + rivet grid. */
function fillFloorBunker(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'fr' | 'fg' | 'fb'>) {
  const rnd = mul(seed)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const strip = Math.floor(y / 5)
      let g = 42 + (strip & 1) * 12 + rnd() * 6
      if (y % 5 === 0) g *= 0.65
      if (x % 11 === 0 || x % 11 === 1) g *= 0.78
      if (x % 11 === 5 && y % 11 === 5) g = 28 + rnd() * 8
      g += (rnd() - 0.5) * 8
      putF(data, w, x, y, g, tint)
    }
  }
}

/** Large uneven flagstones. */
function fillFloorGolem(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'fr' | 'fg' | 'fb'>) {
  const rnd = mul(seed)
  const cell = 19
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      const ix = x % cell
      const iy = y % cell
      const edge = ix < 2 || iy < 2 || ix >= cell - 2 || iy >= cell - 2
      const h0 = ((cx * 47 + cy * 83 + seed) & 7) - 3
      let g = 36 + ((cx * 3 + cy * 5 + seed) & 11) * 2 + rnd() * 14 + h0
      if (edge) g *= 0.52
      g += (rnd() - 0.5) * 10
      putF(data, w, x, y, g, tint)
    }
  }
}

/** Diamond / harlequin stone layout. */
function fillFloorCatacombs(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'fr' | 'fg' | 'fb'>) {
  const rnd = mul(seed)
  const period = 7
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x + y
      const v = x - y
      const du = ((u % (period * 2)) + period * 2) % (period * 2)
      const dv = ((v % (period * 2)) + period * 2) % (period * 2)
      const nearDiag = du < 2 || du > period * 2 - 3 || dv < 2 || dv > period * 2 - 3
      const tile = (Math.floor(u / (period * 2)) + Math.floor(v / (period * 2)) + seed) & 1
      let g = tile ? 48 + rnd() * 12 : 32 + rnd() * 10
      if (nearDiag) g *= 0.58
      g += (rnd() - 0.5) * 8
      putF(data, w, x, y, g, tint)
    }
  }
}

/** Marble checker + thin grout. */
function fillFloorPalace(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'fr' | 'fg' | 'fb'>) {
  const rnd = mul(seed)
  const sz = 8
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ix = x % sz
      const iy = y % sz
      const grout = ix === 0 || iy === 0
      const cell = (Math.floor(x / sz) + Math.floor(y / sz) + seed) & 1
      let g = grout ? 26 + rnd() * 6 : cell ? 72 + rnd() * 10 : 52 + rnd() * 8
      if (!grout && (ix === 1 || iy === 1)) g *= 0.92
      putF(data, w, x, y, g, tint)
    }
  }
}

/** Organic mottling (low-frequency interference + speckle). */
function fillFloorLivingBio(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'fr' | 'fg' | 'fb'>) {
  const rnd = mul(seed)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n1 = Math.sin(x * 0.31 + seed * 0.01) * Math.cos(y * 0.27 + seed * 0.02)
      const n2 = Math.sin((x + y) * 0.19) * 0.5 + 0.5
      let g = 38 + n1 * 22 + n2 * 18 + (rnd() - 0.5) * 16
      if (rnd() < 0.04) g += 25
      putF(data, w, x, y, g, tint)
    }
  }
}

/** Corrugated metal: vertical ridges. */
function fillWallBunker(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'wr' | 'wg' | 'wb'>) {
  const rnd = mul(seed)
  const pitch = 6
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lx = x % pitch
      const ridge = lx === 0 || lx === pitch - 1
      let g = ridge ? 24 + rnd() * 8 : 52 + Math.sin(lx * 0.9) * 8 + rnd() * 10
      if (y % 17 === 0) g *= 0.72
      putW(data, w, x, y, g, tint)
    }
  }
}

/** Massive ashlar blocks, staggered courses. */
function fillWallGolem(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'wr' | 'wg' | 'wb'>) {
  const rnd = mul(seed)
  const bh = 16
  const bw = 20
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const row = Math.floor(y / bh)
      const off = (row % 2) * Math.floor(bw / 2)
      const lx = ((x + off) % bw + bw) % bw
      const ly = y % bh
      const mortar = lx < 2 || ly < 2
      let g = mortar ? 20 + rnd() * 10 : 50 + ((row + Math.floor((x + off) / bw)) & 3) * 8 + rnd() * 14
      g += (rnd() - 0.5) * 10
      putW(data, w, x, y, g, tint)
    }
  }
}

/** Narrow courses + faux arch soffit every few rows. */
function fillWallCatacombs(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'wr' | 'wg' | 'wb'>) {
  const rnd = mul(seed)
  const bh = 5
  const bw = 9
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const row = Math.floor(y / bh)
      const off = (row % 2) * Math.floor(bw / 2)
      const lx = ((x + off) % bw + bw) % bw
      const ly = y % bh
      const mortar = lx < 1 || ly < 1
      const archBand = row % 9 === 3
      const ax = (x % 20) - 10
      const archCurve = archBand ? Math.max(0, 8 - (ax * ax) / 14) : 0
      let g = mortar ? 22 + rnd() * 8 : 44 + archCurve + rnd() * 12
      g += (rnd() - 0.5) * 8
      putW(data, w, x, y, g, tint)
    }
  }
}

/** Fluted pilaster stripes. */
function fillWallPalace(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'wr' | 'wg' | 'wb'>) {
  const rnd = mul(seed)
  const colW = 8
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lx = x % colW
      const flute = lx >= 2 && lx <= 5
      let g = flute ? 58 + Math.sin(lx * 1.2) * 12 : 40 + rnd() * 6
      if (lx === 0 || lx === colW - 1) g = 32 + rnd() * 8
      if (y % 24 === 0 || y % 24 === 1) g *= 0.75
      putW(data, w, x, y, g, tint)
    }
  }
}

/** Cell membrane / blob boundaries. */
function fillWallLivingBio(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'wr' | 'wg' | 'wb'>) {
  const rnd = mul(seed)
  const period = 11
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / period)
      const cy = Math.floor(y / period)
      const ox = ((cx * 37 + cy * 61 + seed) % 5) - 2
      const oy = ((cx * 19 + cy * 43 + seed) % 5) - 2
      const dx = x - (cx * period + period / 2 + ox)
      const dy = y - (cy * period + period / 2 + oy)
      const d = Math.sqrt(dx * dx + dy * dy)
      const edge = d > period * 0.38 && d < period * 0.48
      let g = edge ? 28 + rnd() * 12 : 48 + rnd() * 18 + Math.sin(d * 0.4) * 10
      putW(data, w, x, y, g, tint)
    }
  }
}

/** Vent slots + pipe runs. */
function fillCeilingBunker(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'cr' | 'cg' | 'cb'>) {
  const rnd = mul(seed)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let g = 14 + rnd() * 6
      if (y === 6 || y === 7 || y === 22 || y === 23) g = 32 + rnd() * 12
      if ((x % 10 < 3) && (y > 12 && y < 18)) g = 26 + rnd() * 8
      if (x % 14 === 0) g = Math.min(255, g + 8)
      putC(data, w, x, y, g, tint)
    }
  }
}

/** Radial “crack” spokes from tile centers. */
function fillCeilingGolem(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'cr' | 'cg' | 'cb'>) {
  const rnd = mul(seed)
  const span = 16
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / span) * span + span / 2
      const cy = Math.floor(y / span) * span + span / 2
      const dx = x - cx
      const dy = y - cy
      const ang = Math.abs(Math.atan2(dy, dx))
      const spoke = Math.min(Math.abs(ang), Math.abs(ang - Math.PI / 4), Math.abs(ang - Math.PI / 2)) < 0.12
      const r = Math.sqrt(dx * dx + dy * dy)
      let g = 12 + rnd() * 7
      if (spoke && r > 2) g = 28 + rnd() * 18
      putC(data, w, x, y, g, tint)
    }
  }
}

/** Coffered recess grid. */
function fillCeilingCatacombs(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'cr' | 'cg' | 'cb'>) {
  const rnd = mul(seed)
  const c = 8
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ix = x % c
      const iy = y % c
      const border = ix < 2 || iy < 2 || ix >= c - 2 || iy >= c - 2
      let g = border ? 26 + rnd() * 8 : 10 + rnd() * 6
      if (ix >= 3 && ix <= 4 && iy >= 3 && iy <= 4) g += 6
      putC(data, w, x, y, g, tint)
    }
  }
}

/** Rosette / radial band per cell. */
function fillCeilingPalace(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'cr' | 'cg' | 'cb'>) {
  const rnd = mul(seed)
  const span = 16
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = (Math.floor(x / span) + 0.5) * span
      const cy = (Math.floor(y / span) + 0.5) * span
      const dx = x - cx
      const dy = y - cy
      const r = Math.sqrt(dx * dx + dy * dy)
      const ring = Math.abs(r - 5) < 1.1 || Math.abs(r - 2.2) < 0.55
      let g = ring ? 38 + rnd() * 10 : 16 + rnd() * 8
      putC(data, w, x, y, g, tint)
    }
  }
}

/** Veins + soft glow spots. */
function fillCeilingLivingBio(data: Uint8Array, w: number, h: number, seed: number, tint: Pick<Tint, 'cr' | 'cg' | 'cb'>) {
  const rnd = mul(seed)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let g = 10 + rnd() * 6
      const vx = Math.sin(y * 0.55 + seed * 0.02) > 0.65 && x % 3 !== 0
      if (vx) g += 14
      if (((x + seed) % 9 === 4) && ((y + seed * 3) % 11 === 5)) g = 42 + rnd() * 28
      putC(data, w, x, y, g, tint)
    }
  }
}

function fillFloorFor(
  ft: ProceduralDungeonEnvFloorType,
  data: Uint8Array,
  w: number,
  h: number,
  seed: number,
  tint: Pick<Tint, 'fr' | 'fg' | 'fb'>,
) {
  switch (ft) {
    case 'Bunker':
      fillFloorBunker(data, w, h, seed, tint)
      break
    case 'Golem':
      fillFloorGolem(data, w, h, seed, tint)
      break
    case 'Catacombs':
      fillFloorCatacombs(data, w, h, seed, tint)
      break
    case 'Palace':
      fillFloorPalace(data, w, h, seed, tint)
      break
    case 'LivingBio':
      fillFloorLivingBio(data, w, h, seed, tint)
      break
  }
}

function fillWallFor(
  ft: ProceduralDungeonEnvFloorType,
  data: Uint8Array,
  w: number,
  h: number,
  seed: number,
  tint: Pick<Tint, 'wr' | 'wg' | 'wb'>,
) {
  switch (ft) {
    case 'Bunker':
      fillWallBunker(data, w, h, seed, tint)
      break
    case 'Golem':
      fillWallGolem(data, w, h, seed, tint)
      break
    case 'Catacombs':
      fillWallCatacombs(data, w, h, seed, tint)
      break
    case 'Palace':
      fillWallPalace(data, w, h, seed, tint)
      break
    case 'LivingBio':
      fillWallLivingBio(data, w, h, seed, tint)
      break
  }
}

function fillCeilingFor(
  ft: ProceduralDungeonEnvFloorType,
  data: Uint8Array,
  w: number,
  h: number,
  seed: number,
  tint: Pick<Tint, 'cr' | 'cg' | 'cb'>,
) {
  switch (ft) {
    case 'Bunker':
      fillCeilingBunker(data, w, h, seed, tint)
      break
    case 'Golem':
      fillCeilingGolem(data, w, h, seed, tint)
      break
    case 'Catacombs':
      fillCeilingCatacombs(data, w, h, seed, tint)
      break
    case 'Palace':
      fillCeilingPalace(data, w, h, seed, tint)
      break
    case 'LivingBio':
      fillCeilingLivingBio(data, w, h, seed, tint)
      break
  }
}

function makeDataTex(w: number, h: number, fill: (data: Uint8Array) => void): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4)
  fill(data)
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
  tex.needsUpdate = true
  return tex
}

/**
 * Lightweight procedural albedo triple (~64² floor/wall, 32² ceiling): no PNG decode, tiny VRAM.
 * Each **FloorType** uses a distinct floor/wall/ceiling pattern (not tint-only variants).
 */
export function makeProceduralDungeonEnvTextures(ft: ProceduralDungeonEnvFloorType): {
  floor: THREE.DataTexture
  wall: THREE.DataTexture
  ceiling: THREE.DataTexture
} {
  const { sf, sw, sc } = seedsForFloorType(ft)
  const tint = tintFor(ft)
  const FW = 64
  const FH = 64
  const CW = 32
  const CH = 32
  const floor = makeDataTex(FW, FH, (d) => fillFloorFor(ft, d, FW, FH, sf, tint))
  const wall = makeDataTex(FW, FH, (d) => fillWallFor(ft, d, FW, FH, sw, tint))
  const ceiling = makeDataTex(CW, CH, (d) => fillCeilingFor(ft, d, CW, CH, sc, tint))
  return { floor, wall, ceiling }
}
