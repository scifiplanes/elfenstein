import * as THREE from 'three'

export function makeWallTexture(seed = 1) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const x = c.getContext('2d')!
  x.fillStyle = '#141219'
  x.fillRect(0, 0, 256, 256)

  const bw = 40
  const bh = 24
  const rnd = mul(seed)
  for (let row = 0; row < Math.ceil(256 / bh) + 1; row++) {
    const off = (row % 2) * (bw / 2)
    for (let col = -1; col < Math.ceil(256 / bw) + 1; col++) {
      const bx = col * bw + off
      const by = row * bh
      const v = Math.floor(20 + rnd() * 12)
      x.fillStyle = `rgb(${v},${Math.floor(v * 0.9)},${Math.floor(v * 0.75)})`
      x.fillRect(bx + 1, by + 1, bw - 2, bh - 2)
      x.strokeStyle = 'rgba(0,0,0,0.55)'
      x.lineWidth = 1.2
      x.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1)
    }
  }

  for (let i = 0; i < 90; i++) {
    x.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.25})`
    x.fillRect(rnd() * 256, rnd() * 256, rnd() * 18 + 2, rnd() * 4 + 1)
  }

  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 1)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function makeFloorTexture(seed = 2) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const x = c.getContext('2d')!
  x.fillStyle = '#0d0b10'
  x.fillRect(0, 0, 256, 256)
  const rnd = mul(seed)

  for (let i = 0; i < 70; i++) {
    const px = rnd() * 256
    const py = rnd() * 256
    const r = 3 + rnd() * 14
    x.fillStyle = `rgba(${Math.floor(16 + rnd() * 14)},${Math.floor(14 + rnd() * 10)},${Math.floor(12 + rnd() * 8)},0.55)`
    x.beginPath()
    x.ellipse(px, py, r, r * 0.6, rnd() * Math.PI, 0, Math.PI * 2)
    x.fill()
  }

  x.strokeStyle = 'rgba(0,0,0,0.45)'
  x.lineWidth = 1
  for (let row = 0; row < 16; row++) {
    for (let col = (row % 2) * 12; col < 256; col += 28) {
      x.strokeRect(col, row * 18, 26, 16)
    }
  }

  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1, 1)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function makeCeilTexture(seed = 3) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const x = c.getContext('2d')!
  x.fillStyle = '#07060a'
  x.fillRect(0, 0, 64, 64)
  const rnd = mul(seed)
  for (let i = 0; i < 40; i++) {
    x.fillStyle = `rgba(255,255,255,${0.015 + rnd() * 0.03})`
    x.fillRect(rnd() * 64, rnd() * 64, 1, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 2)
  t.colorSpace = THREE.SRGBColorSpace
  return t
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

