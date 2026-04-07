import * as THREE from 'three'
import { shakeEnvelopeFactor } from '../game/shakeEnvelope'
import type { GameState } from '../game/types'
import { makeCeilTexture, makeFloorTexture, makeWallTexture } from './procTextures'
import { NPC_SPRITE_SRC } from '../game/npc/npcDefs'

export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private rt: THREE.WebGLRenderTarget | null = null
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly lantern: THREE.PointLight
  private readonly lanternBeam: THREE.SpotLight
  private readonly lanternBeamTarget: THREE.Object3D
  private readonly torchLights: THREE.PointLight[] = []

  private lastSize = { w: 0, h: 0 }
  private lastCamFov = NaN
  private lastGeomKey = ''
  private geoGroup: THREE.Group | null = null
  private pickables: THREE.Object3D[] = []
  private readonly raycaster = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()

  private floorMat: THREE.MeshStandardMaterial | null = null
  private wallMat: THREE.MeshStandardMaterial | null = null
  private ceilMat: THREE.MeshStandardMaterial | null = null

  private readonly textureLoader = new THREE.TextureLoader()
  private readonly npcSpriteMats: Partial<Record<GameState['floor']['npcs'][number]['kind'], THREE.SpriteMaterial>> = {}
  private readonly npcSpriteAspects: Partial<Record<GameState['floor']['npcs'][number]['kind'], number>> = {}
  private npcSprites: Array<{ sprite: THREE.Sprite; id: string; kind: GameState['floor']['npcs'][number]['kind'] }> = []

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
    this.renderer.debug.checkShaderErrors = true
    this.renderer.setClearColor(new THREE.Color('#050508'), 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100)
    this.camera.rotation.order = 'YXZ'
    this.camera.position.set(0, 1.15, 0)
    this.scene.add(this.camera)

    // Lantern: give it meaningful reach by default.
    this.lantern = new THREE.PointLight(0xffd7a0, 4.0, 24, 1.0)
    this.lantern.castShadow = true
    this.lantern.shadow.mapSize.set(256, 256)
    this.lantern.shadow.bias = -0.0002
    this.camera.add(this.lantern)

    // A forward-facing beam makes the lantern feel impactful even in fog.
    this.lanternBeamTarget = new THREE.Object3D()
    this.lanternBeam = new THREE.SpotLight(0xffd7a0, 6.5, 28, Math.PI / 5.5, 0.55, 1.0)
    this.lanternBeam.target = this.lanternBeamTarget
    this.lanternBeam.castShadow = true
    this.lanternBeam.shadow.mapSize.set(256, 256)
    this.lanternBeam.shadow.bias = -0.00015
    this.camera.add(this.lanternBeam)
    this.camera.add(this.lanternBeamTarget)

    this.syncSize(1, 1)
  }

  dispose() {
    for (const m of Object.values(this.npcSpriteMats)) {
      if (!m) continue
      m.map?.dispose()
      m.dispose()
    }
    this.geoGroup?.traverse((obj) => {
      const mesh = obj as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
      if (mesh.geometry) mesh.geometry.dispose?.()
      const mat = mesh.material as unknown as { dispose?: () => void } | { dispose?: () => void }[]
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
      else mat?.dispose?.()
    })
    this.rt?.dispose()
    this.rt = null
    this.lastSize = { w: 0, h: 0 }
  }

  /** Ensure the offscreen buffer matches the game viewport in layout CSS px (ignores ancestor `transform: scale`). */
  syncViewportRect(cssLayoutWidth: number, cssLayoutHeight: number) {
    const capped = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.max(1, Math.floor(cssLayoutWidth * capped))
    const h = Math.max(1, Math.floor(cssLayoutHeight * capped))
    this.syncSize(w, h)
  }

  renderFrame(state: GameState) {
    this.syncScene(state)
    this.syncTuning(state)
    this.renderer.setRenderTarget(this.rt)
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(null)
  }

  getRenderTargetTexture(): THREE.Texture | null {
    return this.rt?.texture ?? null
  }

  getRenderTargetSize(): { w: number; h: number } | null {
    if (!this.rt) return null
    return { w: this.rt.width, h: this.rt.height }
  }

  /** Debug helper: read a single pixel from the render target (RGBA 0..255). */
  readRenderTargetPixel(x: number, y: number): Uint8Array | null {
    if (!this.rt) return null
    const w = this.rt.width
    const h = this.rt.height
    const px = Math.max(0, Math.min(w - 1, Math.floor(x)))
    const py = Math.max(0, Math.min(h - 1, Math.floor(y)))
    const out = new Uint8Array(4)
    this.renderer.readRenderTargetPixels(this.rt, px, py, 1, 1, out)
    return out
  }

  pickTarget(
    gameRect: DOMRectReadOnly,
    clientX: number,
    clientY: number,
  ): null | { kind: 'poi'; id: string } | { kind: 'npc'; id: string } | { kind: 'floorItem'; id: string } | { kind: 'door'; id: string } {
    if (!this.pickables.length) return null
    const x = ((clientX - gameRect.left) / gameRect.width) * 2 - 1
    const y = -(((clientY - gameRect.top) / gameRect.height) * 2 - 1)
    this.ndc.set(x, y)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, true)
    const hit = hits[0]
    if (!hit) return null
    const ud = hit.object.userData as unknown as { kind?: unknown; id?: unknown }
    const kind = String(ud.kind ?? '')
    const id = ud.id == null ? '' : String(ud.id)
    if (!id) return null
    if (kind === 'poi') return { kind: 'poi', id }
    if (kind === 'npc') return { kind: 'npc', id }
    if (kind === 'floorItem') return { kind: 'floorItem', id }
    if (kind === 'door') return { kind: 'door', id }
    return null
  }

  pickObject(
    gameRect: DOMRectReadOnly,
    clientX: number,
    clientY: number,
  ): null | { kind: 'poi' | 'npc' | 'floorItem' | 'door'; id: string; worldPos: THREE.Vector3 } {
    if (!this.pickables.length) return null
    const x = ((clientX - gameRect.left) / gameRect.width) * 2 - 1
    const y = -(((clientY - gameRect.top) / gameRect.height) * 2 - 1)
    this.ndc.set(x, y)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, true)
    const hit = hits[0]
    if (!hit) return null
    const ud = hit.object.userData as unknown as { kind?: unknown; id?: unknown }
    const kind = String(ud.kind ?? '')
    const id = ud.id == null ? '' : String(ud.id)
    if (!id) return null
    if (kind !== 'poi' && kind !== 'npc' && kind !== 'floorItem' && kind !== 'door') return null
    return { kind, id, worldPos: hit.point.clone() }
  }

  projectWorldToClient(gameRect: DOMRectReadOnly, pos: THREE.Vector3): { x: number; y: number } {
    const v = pos.clone().project(this.camera)
    const x = (v.x * 0.5 + 0.5) * gameRect.width + gameRect.left
    const y = (-v.y * 0.5 + 0.5) * gameRect.height + gameRect.top
    return { x, y }
  }

  /**
   * Intersect the camera ray through a client pixel with the floor plane (y=0).
   * This is used for cursor-aimed drop placement in the 3D viewport.
   */
  pickFloorPoint(gameRect: DOMRectReadOnly, clientX: number, clientY: number): null | THREE.Vector3 {
    const x = ((clientX - gameRect.left) / gameRect.width) * 2 - 1
    const y = -(((clientY - gameRect.top) / gameRect.height) * 2 - 1)
    this.ndc.set(x, y)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const ray = this.raycaster.ray
    const denom = ray.direction.y
    if (Math.abs(denom) < 1e-6) return null
    const t = (0 - ray.origin.y) / denom
    if (t <= 0) return null
    return ray.origin.clone().add(ray.direction.clone().multiplyScalar(t))
  }

  private syncSize(w: number, h: number) {
    if (this.rt && w === this.lastSize.w && h === this.lastSize.h) return

    // Offscreen renderer: operate purely in framebuffer pixels.
    // IMPORTANT: This renderer is shared with the presenter; don't mutate its canvas size here.
    // We only need the camera aspect to match our RT, and we render to RT via setRenderTarget.
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.lastSize = { w, h }

    this.rt?.dispose()
    this.rt = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: true,
      stencilBuffer: false,
      samples: 0,
      type: THREE.UnsignedByteType,
    })
    this.rt.texture.colorSpace = THREE.SRGBColorSpace
  }

  private syncScene(state: GameState) {
    const key = `${state.floor.w}x${state.floor.h}:${state.floor.tiles.join('')}:${state.floor.pois.map((p)=>p.id+','+p.pos.x+','+p.pos.y+','+(p.opened?'1':'0')).join('|')}:${state.floor.npcs.map((n)=>n.id+','+n.pos.x+','+n.pos.y+','+n.hp).join('|')}:${state.floor.itemsOnFloor.map((i)=>i.id+','+i.pos.x+','+i.pos.y+','+i.jitter.x.toFixed(3)+','+i.jitter.z.toFixed(3)).join('|')}`
    if (key !== this.lastGeomKey) {
      this.lastGeomKey = key
      if (this.geoGroup) this.scene.remove(this.geoGroup)
      this.geoGroup = this.buildGeometry(state)
      this.scene.add(this.geoGroup)
    }

    // Camera reads from view state (supports tweening).
    const basePos = state.view.camPos
    const pitch = (state.render.camPitchDeg * Math.PI) / 180
    const yaw = state.view.camYaw

    // Apply interaction camera shake (3D view). Non-accumulating: derived from base pose each frame.
    const uiShake = state.ui.shake
    const hasShake =
      !!uiShake &&
      uiShake.untilMs > state.nowMs &&
      state.render.camShakeUiMix > 0 &&
      (state.render.camShakePosAmp > 0 || state.render.camShakeRollDeg > 0) &&
      state.render.camShakeHz > 0

    let x = basePos.x
    let y = basePos.y
    let z = basePos.z
    let roll = 0

    // Camera forward/back offset (feel/debug): move along facing without changing grid state.
    const camForward = Number(state.render.camForwardOffset ?? 0)
    if (camForward !== 0) {
      const fx = Math.sin(yaw)
      const fz = -Math.cos(yaw)
      x += fx * camForward
      z += fz * camForward
    }

    if (hasShake) {
      const start = uiShake!.startedAtMs ?? uiShake!.untilMs - 160
      const t = shakeEnvelopeFactor(
        state.nowMs,
        start,
        uiShake!.untilMs,
        state.render.camShakeLengthMs,
        state.render.camShakeDecayMs,
      )
      const mag = Math.max(0, uiShake!.magnitude) * state.render.camShakeUiMix * t

      const nowSec = state.nowMs / 1000
      const w = nowSec * Math.PI * 2 * state.render.camShakeHz
      const dxLocal = Math.sin(w) * state.render.camShakePosAmp * mag
      const dyLocal = Math.cos(w * 0.93 + 1.7) * state.render.camShakePosAmp * 0.75 * mag

      // Convert camera-local X into world space using yaw (good enough for subtle shake).
      const c = Math.cos(yaw)
      const s = Math.sin(yaw)
      x += c * dxLocal
      z += -s * dxLocal
      y += dyLocal

      roll = ((state.render.camShakeRollDeg * Math.PI) / 180) * mag * Math.sin(w * 0.81 + 0.4)
    }

    this.camera.position.set(x, y, z)
    this.camera.rotation.set(pitch, yaw, roll)

    // Lantern is camera-attached; offsets are in camera-local space (forward is -Z).
    this.lantern.position.set(0, state.render.lanternVerticalOffset, -state.render.lanternForwardOffset)
    this.lanternBeam.position.copy(this.lantern.position)

    // Keep the beam pointing where the camera looks.
    const beamDist = Math.max(0.5, state.render.lanternDistance * state.render.lanternBeamDistanceScale)
    this.lanternBeamTarget.position.set(0, 0, -Math.min(6, beamDist))
  }

  private buildGeometry(state: GameState) {
    const g = new THREE.Group()
    this.pickables = []
    this.npcSprites = []

    const wallTex = makeWallTexture(state.floor.seed ^ 0x111)
    const floorTex = makeFloorTexture(state.floor.seed ^ 0x222)
    const ceilTex = makeCeilTexture(state.floor.seed ^ 0x333)

    // Small emissive lift so the scene never becomes pure-black,
    // but low enough that the lantern still changes visibility.
    const base = Math.max(0, state.render.baseEmissive)
    this.floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1, metalness: 0, emissive: new THREE.Color('#101018'), emissiveIntensity: base * 1.0 })
    this.wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1, metalness: 0, emissive: new THREE.Color('#161210'), emissiveIntensity: base * 0.8 })
    this.ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1, metalness: 0, emissive: new THREE.Color('#05050a'), emissiveIntensity: base * 0.6 })

    const floorGeo = new THREE.BoxGeometry(1, 0.1, 1)
    const wallGeo = new THREE.BoxGeometry(1, 1.2, 1)
    const ceilGeo = new THREE.BoxGeometry(1, 0.1, 1)

    const { w, h, tiles } = state.floor
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = tiles[x + y * w]
        const wx = x - w / 2
        const wz = y - h / 2
        if (t === 'floor') {
          const m = new THREE.Mesh(floorGeo, this.floorMat)
          m.position.set(wx, -0.05, wz)
          m.receiveShadow = true
          g.add(m)

          const c = new THREE.Mesh(ceilGeo, this.ceilMat)
          c.position.set(wx, 1.25, wz)
          c.receiveShadow = true
          g.add(c)
        } else if (t === 'door' || t === 'lockedDoor') {
          // Door occupies a floor tile position.
          const m = new THREE.Mesh(floorGeo, this.floorMat)
          m.position.set(wx, -0.05, wz)
          m.receiveShadow = true
          g.add(m)

          const c = new THREE.Mesh(ceilGeo, this.ceilMat)
          c.position.set(wx, 1.25, wz)
          c.receiveShadow = true
          g.add(c)

          const doorGeo = new THREE.BoxGeometry(0.9, 1.1, 0.15)
          const doorMat = new THREE.MeshStandardMaterial({
            color: t === 'lockedDoor' ? new THREE.Color('#7a2a18') : new THREE.Color('#6a4a20'),
            emissive: new THREE.Color('#120a06'),
            emissiveIntensity: base * 0.4,
            roughness: 0.9,
            metalness: 0.05,
          })
          const d = new THREE.Mesh(doorGeo, doorMat)
          d.position.set(wx, 0.55, wz)
          d.castShadow = true
          d.receiveShadow = true
          d.userData = { kind: 'door', id: `${x},${y}` }
          g.add(d)
          this.pickables.push(d)
        } else {
          const m = new THREE.Mesh(wallGeo, this.wallMat)
          m.position.set(wx, 0.55, wz)
          m.castShadow = true
          m.receiveShadow = true
          g.add(m)
        }
      }
    }

    const poiMat = makeBillboardMaterial('✦', '#ffd59a')
    const itemMat = makeBillboardMaterial('◻', '#b6ff8b')

    state.floor.pois.forEach((p) => {
      const x = p.pos.x - w / 2
      const z = p.pos.y - h / 2
      const s = new THREE.Sprite(poiMat)
      s.position.set(x, 0.72, z)
      s.scale.set(0.55, 0.55, 1)
      s.userData = { kind: 'poi', id: p.id }
      g.add(s)
      this.pickables.push(s)
    })

    state.floor.npcs.forEach((n) => {
      const x = n.pos.x - w / 2
      const z = n.pos.y - h / 2
      const s = new THREE.Sprite(this.getNpcSpriteMat(n.kind))
      s.position.set(x, 0.38, z)
      // Scale is applied in `syncTuning()` so it can react to debug tuning and texture load (aspect).
      s.userData = { kind: 'npc', id: n.id }
      g.add(s)
      this.pickables.push(s)
      this.npcSprites.push({ sprite: s, id: n.id, kind: n.kind })
    })

    state.floor.itemsOnFloor.forEach((it) => {
      const x = it.pos.x - w / 2 + (it.jitter?.x ?? 0)
      const z = it.pos.y - h / 2 + (it.jitter?.z ?? 0)
      const s = new THREE.Sprite(itemMat)
      s.position.set(x, 0.18, z)
      s.scale.set(0.5, 0.5, 1)
      s.userData = { kind: 'floorItem', id: it.id }
      g.add(s)
      this.pickables.push(s)
    })

    return g
  }

  private syncTuning(state: GameState) {
    if (state.render.fogEnabled > 0) {
      this.scene.fog = new THREE.FogExp2(0x050508, Math.max(0, state.render.fogDensity))
    } else {
      this.scene.fog = null
    }

    if (state.render.camFov !== this.lastCamFov) {
      this.lastCamFov = state.render.camFov
      this.camera.fov = state.render.camFov
      this.camera.updateProjectionMatrix()
    }

    const t = state.nowMs / 1000

    const flicker =
      state.render.lanternFlickerAmp <= 0 || state.render.lanternFlickerHz <= 0
        ? 1
        : 1 + state.render.lanternFlickerAmp * Math.sin(t * Math.PI * 2 * state.render.lanternFlickerHz)

    this.lantern.intensity = Math.max(0, state.render.lanternIntensity * flicker)
    this.lantern.distance = state.render.lanternDistance
    this.lantern.color.setHex(0xffd7a0)
    this.lanternBeam.intensity = Math.max(0, state.render.lanternIntensity * state.render.lanternBeamIntensityScale * flicker)
    this.lanternBeam.distance = Math.max(0.5, state.render.lanternDistance * state.render.lanternBeamDistanceScale)
    this.lanternBeam.angle = (Math.max(1, state.render.lanternBeamAngleDeg) * Math.PI) / 180
    this.lanternBeam.penumbra = Math.max(0, Math.min(1, state.render.lanternBeamPenumbra))
    this.lanternBeam.color.setHex(0xffd7a0)

    // Apply base emissive lift without forcing a rebuild.
    const base = Math.max(0, state.render.baseEmissive)
    if (this.floorMat) this.floorMat.emissiveIntensity = base * 1.0
    if (this.wallMat) this.wallMat.emissiveIntensity = base * 0.8
    if (this.ceilMat) this.ceilMat.emissiveIntensity = base * 0.6

    // Ensure up to 6 torch lights near POIs.
    const desired = Math.min(6, state.floor.pois.length)
    while (this.torchLights.length < desired) {
      const l = new THREE.PointLight(0xff8a3d, 1.0, state.render.torchDistance, 2.0)
      this.torchLights.push(l)
      this.scene.add(l)
    }
    while (this.torchLights.length > desired) {
      const l = this.torchLights.pop()!
      this.scene.remove(l)
      ;(l as unknown as { dispose?: () => void }).dispose?.()
    }
    for (let i = 0; i < desired; i++) {
      const p = state.floor.pois[i]
      const x = p.pos.x - state.floor.w / 2
      const z = p.pos.y - state.floor.h / 2
      const flicker = 0.85 + 0.15 * Math.sin(t * 7.0 + i * 1.7)
      this.torchLights[i].position.set(x, 0.9, z)
      this.torchLights[i].distance = state.render.torchDistance
      this.torchLights[i].intensity = state.render.torchIntensity * flicker
    }

    this.syncNpcSpriteScales(state)
  }

  private getNpcSpriteMat(kind: GameState['floor']['npcs'][number]['kind']): THREE.SpriteMaterial {
    const cached = this.npcSpriteMats[kind]
    if (cached) return cached

    const src = NPC_SPRITE_SRC[kind]
    const tex = this.textureLoader.load(src, () => {
      const img = tex.image as unknown as { width?: unknown; height?: unknown } | undefined
      const w = img && typeof img.width === 'number' ? img.width : 0
      const h = img && typeof img.height === 'number' ? img.height : 0
      if (w > 0 && h > 0) this.npcSpriteAspects[kind] = w / h
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false

    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    this.npcSpriteMats[kind] = mat
    return mat
  }

  private syncNpcSpriteScales(state: GameState) {
    if (!this.npcSprites.length) return

    for (const n of this.npcSprites) {
      const size = this.getNpcSizeForKind(state, n.kind, n.id)
      const aspect = this.npcSpriteAspects[n.kind] ?? 1.0
      const width = size * aspect
      n.sprite.scale.set(width, size, 1)

      // Align the bottom of the sprite with the floor surface.
      // Floor top is y=0 (floor boxes are centered at y=-0.05 with height 0.1).
      const floorTopY = 0
      const lift = Number(state.render.npcFootLift ?? 0)
      const groundY = this.getNpcGroundYForKind(state, n.kind)
      n.sprite.position.y = floorTopY + lift + size * (0.5 - groundY)
    }
  }

  private getNpcGroundYForKind(state: GameState, kind: GameState['floor']['npcs'][number]['kind']) {
    if (kind === 'Wurglepup') return state.render.npcGroundY_Wurglepup
    if (kind === 'Bobr') return state.render.npcGroundY_Bobr
    if (kind === 'Skeleton') return state.render.npcGroundY_Skeleton
    return state.render.npcGroundY_Catoctopus
  }

  private getNpcSizeForKind(state: GameState, kind: GameState['floor']['npcs'][number]['kind'], npcId: string) {
    const base = this.getNpcBaseSizeForKind(state, kind)
    const randPct = this.getNpcSizeRandForKind(state, kind)
    const signed = this.signedUnitFromStr(`npcSize:${state.floor.seed}:${kind}:${npcId}`)
    const factor = 1 + signed * randPct
    return Math.max(0.05, base * factor)
  }

  private getNpcBaseSizeForKind(state: GameState, kind: GameState['floor']['npcs'][number]['kind']) {
    if (kind === 'Wurglepup') return state.render.npcSize_Wurglepup
    if (kind === 'Bobr') return state.render.npcSize_Bobr
    if (kind === 'Skeleton') return state.render.npcSize_Skeleton
    return state.render.npcSize_Catoctopus
  }

  private getNpcSizeRandForKind(state: GameState, kind: GameState['floor']['npcs'][number]['kind']) {
    if (kind === 'Wurglepup') return state.render.npcSizeRand_Wurglepup
    if (kind === 'Bobr') return state.render.npcSizeRand_Bobr
    if (kind === 'Skeleton') return state.render.npcSizeRand_Skeleton
    return state.render.npcSizeRand_Catoctopus
  }

  private signedUnitFromStr(s: string) {
    // Deterministic in [-1, 1], stable across reloads for the same input string.
    const u01 = (this.hashStr(s) >>> 0) / 0x1_0000_0000
    return u01 * 2 - 1
  }

  private hashStr(s: string) {
    let h = 2166136261 >>> 0
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }

}

function makeBillboardMaterial(glyph: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '96px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillText(glyph, 64 + 4, 64 + 6)
  ctx.fillStyle = color
  ctx.fillText(glyph, 64, 64)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  return mat
}

