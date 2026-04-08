import * as THREE from 'three'
import { shakeEnvelopeFactor } from '../game/shakeEnvelope'
import type { GameState, NpcKind, PoiKind } from '../game/types'
import type { DistrictTag, GenRoom } from '../procgen/types'
import {
  DUNGEON_CEILING_TEXTURE_SRC,
  DUNGEON_FLOOR_TEXTURE_SRC,
  DUNGEON_WALL_TEXTURE_SRC,
} from './dungeonEnvTextures'
import { NPC_SPRITE_IDLE_SRC, NPC_SPRITE_SRC } from '../game/npc/npcDefs'
import {
  POI_CHEST_OPEN_SRC,
  POI_SPRITE_SRC,
  POI_WELL_DRAINED_SRC,
  POI_WELL_GLOW_SRC,
  POI_WELL_SPARKLE_FRAMES,
} from '../game/poi/poiDefs'
import { getThemeLightIntent } from './themeTuning'

const TAU = Math.PI * 2

function wrapPi(a: number) {
  // Normalize into (-π, π] to keep Euler->quaternion conversions stable even if upstream yaw drifts.
  // JS `%` is remainder (keeps sign), so we must re-wrap into [0, 2π) first.
  const r = ((a + Math.PI) % TAU + TAU) % TAU // [0, 2π)
  return r - Math.PI // (-π, π]
}

function canonicalYawForDir(dir: 0 | 1 | 2 | 3) {
  return wrapPi((dir * Math.PI) / 2)
}

function nearestPoisByManhattan<T extends { pos: { x: number; y: number } }>(
  pois: readonly T[],
  px: number,
  py: number,
  max: number,
): T[] {
  if (max <= 0 || pois.length === 0) return []
  const scored = pois.map((p) => ({
    p,
    d: Math.abs(p.pos.x - px) + Math.abs(p.pos.y - py),
  }))
  scored.sort((a, b) => a.d - b.d)
  const n = Math.min(max, pois.length)
  return scored.slice(0, n).map((x) => x.p)
}

export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private rt: THREE.WebGLRenderTarget | null = null
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly lantern: THREE.PointLight
  private readonly lanternBeam: THREE.SpotLight
  private readonly lanternBeamTarget: THREE.Object3D
  private readonly torchLights: THREE.PointLight[] = []

  private expFog: THREE.FogExp2 | null = null
  private lastShadowMapSize = 0
  private lastShadowFilter: THREE.ShadowMapType | null = null

  private lastSize = { w: 0, h: 0 }
  private lastCamFov = NaN
  private lastGeomKey = ''
  private geoGroup: THREE.Group | null = null
  private pickables: THREE.Object3D[] = []
  private readonly raycaster = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()

  private floorMat: THREE.MeshLambertMaterial | null = null
  private wallMat: THREE.MeshLambertMaterial | null = null
  private ceilMat: THREE.MeshLambertMaterial | null = null

  private dungeonFloorTex: THREE.Texture | null = null
  private dungeonWallTex: THREE.Texture | null = null
  private dungeonCeilTex: THREE.Texture | null = null

  private readonly textureLoader = new THREE.TextureLoader()
  private readonly npcSpriteMats: Partial<Record<NpcKind, THREE.SpriteMaterial>> = {}
  private readonly npcSpriteAspects: Partial<Record<NpcKind, number>> = {}
  private readonly npcSpriteBaseTex: Partial<Record<NpcKind, THREE.Texture>> = {}
  private readonly npcIdleTextures: Partial<Record<NpcKind, THREE.Texture>> = {}
  private npcSprites: Array<{ sprite: THREE.Sprite; id: string; kind: NpcKind }> = []

  private readonly poiSpriteMats: Partial<Record<PoiKind, THREE.SpriteMaterial>> = {}
  private readonly poiSpriteAspects: Partial<Record<PoiKind, number>> = {}
  private poiSprites: Array<{ sprite: THREE.Sprite; id: string; kind: PoiKind }> = []
  private lastPoiSpriteBoost = NaN
  private themeSpriteColor = new THREE.Color('#ffffff')
  private readonly tmpHsl = { h: 0, s: 0, l: 0 }

  private wellDrainedMat: THREE.SpriteMaterial | null = null
  private chestOpenMat: THREE.SpriteMaterial | null = null
  private wellGlowMat: THREE.SpriteMaterial | null = null
  private wellSparkleMat: THREE.SpriteMaterial | null = null
  private wellSparkleTextures: THREE.Texture[] = []
  private wellDecorSprites: Array<{ main: THREE.Sprite; glow: THREE.Sprite; sparkle: THREE.Sprite }> = []

  private procgenDebugGroup: THREE.Group | null = null
  private lastProcgenDebugKey = ''

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
    for (const t of Object.values(this.npcSpriteBaseTex)) {
      t?.dispose()
    }
    for (const t of Object.values(this.npcIdleTextures)) {
      t?.dispose()
    }
    for (const m of Object.values(this.npcSpriteMats)) {
      if (!m) continue
      m.map = null
      m.dispose()
    }
    for (const m of Object.values(this.poiSpriteMats)) {
      if (!m) continue
      m.map?.dispose()
      m.dispose()
    }
    if (this.wellDrainedMat) {
      this.wellDrainedMat.map?.dispose()
      this.wellDrainedMat.dispose()
      this.wellDrainedMat = null
    }
    if (this.chestOpenMat) {
      this.chestOpenMat.map?.dispose()
      this.chestOpenMat.dispose()
      this.chestOpenMat = null
    }
    if (this.wellGlowMat) {
      this.wellGlowMat.map?.dispose()
      this.wellGlowMat.dispose()
      this.wellGlowMat = null
    }
    if (this.wellSparkleMat) {
      this.wellSparkleMat.map = null
      this.wellSparkleMat.dispose()
      this.wellSparkleMat = null
    }
    for (const t of this.wellSparkleTextures) t.dispose()
    this.wellSparkleTextures = []
    if (this.dungeonFloorTex) {
      this.dungeonFloorTex.dispose()
      this.dungeonFloorTex = null
    }
    if (this.dungeonWallTex) {
      this.dungeonWallTex.dispose()
      this.dungeonWallTex = null
    }
    if (this.dungeonCeilTex) {
      this.dungeonCeilTex.dispose()
      this.dungeonCeilTex = null
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
    this.disposeProcgenDebugOverlay()
  }

  /** Ensure the offscreen buffer matches the game viewport in layout CSS px (ignores ancestor `transform: scale`). */
  syncViewportRect(cssLayoutWidth: number, cssLayoutHeight: number) {
    // Browser zoom changes `devicePixelRatio`; compensate using `visualViewport.scale` so
    // the render target stays consistent with compositor pixel math across zoom levels.
    const vvScale = window.visualViewport?.scale || 1
    const effectiveDpr = (window.devicePixelRatio || 1) / Math.max(1e-6, vvScale)
    const capped = Math.min(effectiveDpr, 1.5)
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

  /**
   * Ray hits are distance-sorted (closest first). Prefer the nearest floor item on the ray so POI
   * billboards (e.g. chests) do not block click/hover/drag on loot behind them.
   */
  private resolvePickHit(hits: THREE.Intersection[]): THREE.Intersection | null {
    let firstOther: THREE.Intersection | null = null
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i]!
      const ud = hit.object.userData as unknown as { kind?: unknown; id?: unknown }
      const kind = String(ud.kind ?? '')
      const id = ud.id == null ? '' : String(ud.id)
      if (!id) continue
      if (kind === 'floorItem') return hit
      if (kind === 'poi' || kind === 'npc' || kind === 'door') {
        if (!firstOther) firstOther = hit
      }
    }
    return firstOther
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
    const hit = this.resolvePickHit(hits)
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
    const hit = this.resolvePickHit(hits)
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
    const th = state.floor.gen?.theme
    const themeKey = th ? `${th.id}:${th.floorColor}:${th.wallColor}:${th.ceilColor}` : 'default'
    const key = `${state.floor.w}x${state.floor.h}:${state.floor.tiles.join('')}:${state.floor.pois.map((p)=>p.id+','+p.pos.x+','+p.pos.y+','+(p.opened?'1':'0')+','+(p.drained?'1':'0')).join('|')}:${state.floor.npcs.map((n)=>n.id+','+n.pos.x+','+n.pos.y+','+n.hp).join('|')}:${state.floor.itemsOnFloor.map((i)=>i.id+','+i.pos.x+','+i.pos.y+','+i.jitter.x.toFixed(3)+','+i.jitter.z.toFixed(3)).join('|')}:${themeKey}`
    if (key !== this.lastGeomKey) {
      this.lastGeomKey = key
      if (this.geoGroup) this.scene.remove(this.geoGroup)
      this.geoGroup = this.buildGeometry(state)
      this.scene.add(this.geoGroup)
    }

    // Camera reads from view state (supports tweening).
    const basePos = state.view.camPos
    const pitch = (state.render.camPitchDeg * Math.PI) / 180
    // Game yaw uses forward (sin(y), 0, -cos(y)) in world XZ. Three.js `rotation.y` rotates local -Z
    // into (-sin(y), 0, -cos(y)) — opposite X sign — so we negate here to match game/minimap facing.
    const yawRaw = state.view.anim?.kind === 'turn' ? state.view.camYaw : canonicalYawForDir(state.floor.playerDir)
    const yawGame = wrapPi(yawRaw)
    const yawThree = -yawGame

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
      const fx = Math.sin(yawGame)
      const fz = -Math.cos(yawGame)
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

      // Align shake lateral translation with Three.js camera orientation (yawThree).
      const c = Math.cos(yawThree)
      const s = Math.sin(yawThree)
      x += c * dxLocal
      z += -s * dxLocal
      y += dyLocal

      roll = ((state.render.camShakeRollDeg * Math.PI) / 180) * mag * Math.sin(w * 0.81 + 0.4)
    }

    this.camera.position.set(x, y, z)
    this.camera.rotation.set(pitch, yawThree, roll)

    this.syncProcgenDebugOverlay(state)

    // Lantern is camera-attached; offsets are in camera-local space (forward is -Z).
    this.lantern.position.set(0, state.render.lanternVerticalOffset, -state.render.lanternForwardOffset)
    this.lanternBeam.position.copy(this.lantern.position)

    // Keep the beam pointing where the camera looks.
    const beamDist = Math.max(0.5, state.render.lanternDistance * state.render.lanternBeamDistanceScale)
    this.lanternBeamTarget.position.set(0, 0, -Math.min(6, beamDist))
  }

  private getDungeonFloorTexture(): THREE.Texture {
    if (this.dungeonFloorTex) return this.dungeonFloorTex
    const tex = this.textureLoader.load(DUNGEON_FLOOR_TEXTURE_SRC)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
    this.dungeonFloorTex = tex
    return tex
  }

  private getDungeonWallTexture(): THREE.Texture {
    if (this.dungeonWallTex) return this.dungeonWallTex
    const tex = this.textureLoader.load(DUNGEON_WALL_TEXTURE_SRC)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
    this.dungeonWallTex = tex
    return tex
  }

  private getDungeonCeilingTexture(): THREE.Texture {
    if (this.dungeonCeilTex) return this.dungeonCeilTex
    const tex = this.textureLoader.load(DUNGEON_CEILING_TEXTURE_SRC)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
    this.dungeonCeilTex = tex
    return tex
  }

  private buildGeometry(state: GameState) {
    const g = new THREE.Group()
    this.pickables = []
    this.npcSprites = []
    this.poiSprites = []
    this.wellDecorSprites = []

    const wallTex = this.getDungeonWallTexture()
    const floorTex = this.getDungeonFloorTexture()
    const ceilTex = this.getDungeonCeilingTexture()

    // Small emissive lift so the scene never becomes pure-black,
    // but low enough that the lantern still changes visibility.
    const base = Math.max(0, state.render.baseEmissive)
    this.floorMat = new THREE.MeshLambertMaterial({
      map: floorTex,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#101018'),
      emissiveIntensity: base * 1.0,
    })
    this.wallMat = new THREE.MeshLambertMaterial({
      map: wallTex,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#161210'),
      emissiveIntensity: base * 0.8,
    })
    this.ceilMat = new THREE.MeshLambertMaterial({
      map: ceilTex,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#05050a'),
      emissiveIntensity: base * 0.6,
    })

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
          const doorMat = new THREE.MeshLambertMaterial({
            color: t === 'lockedDoor' ? new THREE.Color('#7a2a18') : new THREE.Color('#6a4a20'),
            emissive: new THREE.Color('#120a06'),
            emissiveIntensity: base * 0.4,
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

    const itemMat = makeBillboardMaterial('◻', '#b6ff8b')

    state.floor.pois.forEach((p) => {
      const x = p.pos.x - w / 2
      const z = p.pos.y - h / 2
      const mat =
        p.kind === 'Well' && p.drained
          ? this.getWellDrainedMat()
          : p.kind === 'Chest' && p.opened
            ? this.getChestOpenMat()
            : this.getPoiSpriteMat(p.kind)
      const s = new THREE.Sprite(mat)
      s.position.set(x, 0, z)
      // Scale and floor grounding are applied in `syncTuning()` (same center-pivot math as NPCs).
      s.userData = { kind: 'poi', id: p.id }
      g.add(s)
      this.pickables.push(s)
      this.poiSprites.push({ sprite: s, id: p.id, kind: p.kind })

      if (p.kind === 'Well' && !p.drained) {
        const glow = new THREE.Sprite(this.getWellGlowMat())
        glow.position.set(x, 0, z)
        glow.renderOrder = s.renderOrder - 1
        const sparkle = new THREE.Sprite(this.getWellSparkleMat())
        sparkle.position.set(x, 0, z)
        sparkle.renderOrder = s.renderOrder + 1
        g.add(glow)
        g.add(sparkle)
        this.wellDecorSprites.push({ main: s, glow, sparkle })
      }
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
    const themeId = state.floor.gen?.theme?.id
    const intent = getThemeLightIntent(themeId)
    const globalI = Math.max(0, Number(state.render.globalIntensity ?? 1.0))

    if (state.render.fogEnabled > 0) {
      if (!this.expFog) this.expFog = new THREE.FogExp2(0x050508, 0)
      this.expFog.color.setHex(0x050508)
      this.expFog.density = Math.max(0, state.render.fogDensity)
      this.scene.fog = this.expFog
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

    this.lantern.intensity = Math.max(0, state.render.lanternIntensity * (intent.lanternIntensityMult ?? 1.0) * globalI * flicker)
    this.lantern.distance = state.render.lanternDistance
    {
      const base = new THREE.Color(0xffd7a0)
      const tint = new THREE.Color(intent.intentHex)
      const tweak = this.getThemeHueSat(state, themeId)
      tint.getHSL(this.tmpHsl)
      this.tmpHsl.h = ((this.tmpHsl.h + tweak.hueShiftDeg / 360) % 1 + 1) % 1
      this.tmpHsl.s = Math.max(0, Math.min(1, this.tmpHsl.s * tweak.saturationMult))
      tint.setHSL(this.tmpHsl.h, this.tmpHsl.s, this.tmpHsl.l)
      const final = base.lerp(tint, Math.max(0, Math.min(1, intent.mix)))
      this.lantern.color.copy(final)
      this.lanternBeam.color.copy(final)
      this.themeSpriteColor.copy(final).multiplyScalar(globalI)
    }
    this.lanternBeam.intensity = Math.max(0, state.render.lanternIntensity * state.render.lanternBeamIntensityScale * globalI * flicker)
    this.lanternBeam.distance = Math.max(0.5, state.render.lanternDistance * state.render.lanternBeamDistanceScale)
    this.lanternBeam.angle = (Math.max(1, state.render.lanternBeamAngleDeg) * Math.PI) / 180
    this.lanternBeam.penumbra = Math.max(0, Math.min(1, state.render.lanternBeamPenumbra))

    const beamEff = Math.max(0, state.render.lanternIntensity * state.render.lanternBeamIntensityScale * flicker)
    const beamLit = beamEff > 1e-4
    this.lanternBeam.visible = beamLit

    const mapSize = state.render.shadowMapSize
    if (mapSize !== this.lastShadowMapSize) {
      this.lastShadowMapSize = mapSize
      this.lantern.shadow.mapSize.set(mapSize, mapSize)
      this.lanternBeam.shadow.mapSize.set(mapSize, mapSize)
      this.lantern.shadow.needsUpdate = true
      this.lanternBeam.shadow.needsUpdate = true
    }

    const filterChoices = [THREE.BasicShadowMap, THREE.PCFShadowMap, THREE.PCFSoftShadowMap] as const
    const nextFilter = filterChoices[state.render.shadowFilter] ?? THREE.PCFSoftShadowMap
    if (this.lastShadowFilter !== nextFilter) {
      this.lastShadowFilter = nextFilter
      this.renderer.shadowMap.type = nextFilter
      this.renderer.shadowMap.needsUpdate = true
    }

    const wantBeamShadow = beamLit && state.render.shadowLanternBeam > 0
    const wantPointShadow = state.render.shadowLanternPoint > 0
    this.lanternBeam.castShadow = wantBeamShadow
    this.lantern.castShadow = wantPointShadow
    this.renderer.shadowMap.enabled = wantBeamShadow || wantPointShadow

    // Apply base emissive lift without forcing a rebuild.
    const base = Math.max(0, state.render.baseEmissive) * globalI
    if (this.floorMat) this.floorMat.emissiveIntensity = base * 1.0
    if (this.wallMat) this.wallMat.emissiveIntensity = base * 0.8
    if (this.ceilMat) this.ceilMat.emissiveIntensity = base * 0.6

    const torchPicked = nearestPoisByManhattan(
      state.floor.pois,
      state.floor.playerPos.x,
      state.floor.playerPos.y,
      state.render.torchPoiLightMax,
    )
    const desired = torchPicked.length
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
      const p = torchPicked[i]!
      const x = p.pos.x - state.floor.w / 2
      const z = p.pos.y - state.floor.h / 2
      const tf = 0.85 + 0.15 * Math.sin(t * 7.0 + i * 1.7)
      this.torchLights[i].position.set(x, 0.9, z)
      this.torchLights[i].distance = state.render.torchDistance
      this.torchLights[i].intensity = state.render.torchIntensity * (intent.torchIntensityMult ?? 1.0) * globalI * tf
      this.torchLights[i].color.copy(this.lantern.color)
    }

    this.syncPoiSpriteBoost(state)
    this.syncNpcSpriteThemeTint()
    this.syncFloorItemThemeTint()
    this.syncNpcSpriteScales(state)
    this.syncPoiSpriteScales(state)
    this.syncNpcIdleFrames(state)
    this.syncWellSparkleFrame(state)
  }

  private syncPoiSpriteBoost(state: GameState) {
    const next = Math.max(0, Number(state.render.poiSpriteBoost ?? 1.0))
    this.lastPoiSpriteBoost = next

    for (const mat of Object.values(this.poiSpriteMats)) {
      if (!mat) continue
      mat.color.copy(this.themeSpriteColor).multiplyScalar(next)
    }
    if (this.wellDrainedMat) this.wellDrainedMat.color.copy(this.themeSpriteColor).multiplyScalar(next)
    if (this.chestOpenMat) this.chestOpenMat.color.copy(this.themeSpriteColor).multiplyScalar(next)
  }

  private syncNpcSpriteThemeTint() {
    for (const mat of Object.values(this.npcSpriteMats)) {
      if (!mat) continue
      mat.color.copy(this.themeSpriteColor)
    }
  }

  private syncFloorItemThemeTint() {
    // Floor-item sprites use per-instance materials; update live sprites only.
    for (const p of this.pickables) {
      const ud = (p as any)?.userData as undefined | { kind?: string }
      if (!ud || ud.kind !== 'floorItem') continue
      const spr = p as THREE.Sprite
      const mat = spr.material as THREE.SpriteMaterial
      mat.color.copy(this.themeSpriteColor)
    }
  }

  private getThemeHueSat(state: GameState, themeId: string | undefined): { hueShiftDeg: number; saturationMult: number } {
    if (!themeId) return { hueShiftDeg: 0, saturationMult: 1.0 }
    if (themeId === 'dungeon_warm') {
      return { hueShiftDeg: state.render.themeHueShiftDeg_dungeon_warm, saturationMult: state.render.themeSaturation_dungeon_warm }
    }
    if (themeId === 'dungeon_cool') {
      return { hueShiftDeg: state.render.themeHueShiftDeg_dungeon_cool, saturationMult: state.render.themeSaturation_dungeon_cool }
    }
    if (themeId === 'cave_damp') {
      return { hueShiftDeg: state.render.themeHueShiftDeg_cave_damp, saturationMult: state.render.themeSaturation_cave_damp }
    }
    if (themeId === 'cave_deep') {
      return { hueShiftDeg: state.render.themeHueShiftDeg_cave_deep, saturationMult: state.render.themeSaturation_cave_deep }
    }
    if (themeId === 'ruins_bleach') {
      return { hueShiftDeg: state.render.themeHueShiftDeg_ruins_bleach, saturationMult: state.render.themeSaturation_ruins_bleach }
    }
    if (themeId === 'ruins_umber') {
      return { hueShiftDeg: state.render.themeHueShiftDeg_ruins_umber, saturationMult: state.render.themeSaturation_ruins_umber }
    }
    return { hueShiftDeg: 0, saturationMult: 1.0 }
  }

  private currentPoiSpriteBoost() {
    return Number.isFinite(this.lastPoiSpriteBoost) ? this.lastPoiSpriteBoost : 1.0
  }

  private getWellDrainedMat(): THREE.SpriteMaterial {
    if (this.wellDrainedMat) return this.wellDrainedMat
    const tex = this.textureLoader.load(POI_WELL_DRAINED_SRC, () => {
      const img = tex.image as unknown as { width?: unknown; height?: unknown } | undefined
      const iw = img && typeof img.width === 'number' ? img.width : 0
      const ih = img && typeof img.height === 'number' ? img.height : 0
      if (iw > 0 && ih > 0) this.poiSpriteAspects.Well = iw / ih
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.wellDrainedMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    this.wellDrainedMat.color.copy(this.themeSpriteColor).multiplyScalar(this.currentPoiSpriteBoost())
    return this.wellDrainedMat
  }

  private getChestOpenMat(): THREE.SpriteMaterial {
    if (this.chestOpenMat) return this.chestOpenMat
    const tex = this.textureLoader.load(POI_CHEST_OPEN_SRC, () => {
      const img = tex.image as unknown as { width?: unknown; height?: unknown } | undefined
      const iw = img && typeof img.width === 'number' ? img.width : 0
      const ih = img && typeof img.height === 'number' ? img.height : 0
      if (iw > 0 && ih > 0) this.poiSpriteAspects.Chest = iw / ih
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.chestOpenMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    this.chestOpenMat.color.copy(this.themeSpriteColor).multiplyScalar(this.currentPoiSpriteBoost())
    return this.chestOpenMat
  }

  private getWellGlowMat(): THREE.SpriteMaterial {
    if (this.wellGlowMat) return this.wellGlowMat
    const tex = this.textureLoader.load(POI_WELL_GLOW_SRC)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.wellGlowMat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.92,
    })
    return this.wellGlowMat
  }

  private getWellSparkleMat(): THREE.SpriteMaterial {
    if (this.wellSparkleMat) return this.wellSparkleMat
    this.wellSparkleTextures = POI_WELL_SPARKLE_FRAMES.map((src) => {
      const tex = this.textureLoader.load(src)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.NearestFilter
      tex.magFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      return tex
    })
    const first = this.wellSparkleTextures[0]
    this.wellSparkleMat = new THREE.SpriteMaterial({
      map: first,
      transparent: true,
      depthWrite: false,
    })
    return this.wellSparkleMat
  }

  private getPoiSpriteMat(kind: PoiKind): THREE.SpriteMaterial {
    const cached = this.poiSpriteMats[kind]
    if (cached) return cached

    const src = POI_SPRITE_SRC[kind]
    const tex = this.textureLoader.load(src, () => {
      const img = tex.image as unknown as { width?: unknown; height?: unknown } | undefined
      const iw = img && typeof img.width === 'number' ? img.width : 0
      const ih = img && typeof img.height === 'number' ? img.height : 0
      if (iw > 0 && ih > 0) this.poiSpriteAspects[kind] = iw / ih
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false

    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    mat.color.copy(this.themeSpriteColor).multiplyScalar(this.currentPoiSpriteBoost())
    this.poiSpriteMats[kind] = mat
    return mat
  }

  private syncPoiSpriteScales(state: GameState) {
    if (!this.poiSprites.length) return

    const floorTopY = 0
    const lift = Number(state.render.npcFootLift ?? 0)
    const baseH = 0.55
    for (const p of this.poiSprites) {
      const aspect = this.poiSpriteAspects[p.kind] ?? 1.0
      p.sprite.scale.set(baseH * aspect, baseH, 1)
      const groundY = this.getPoiGroundYForKind(state, p.kind)
      p.sprite.position.y = floorTopY + lift + baseH * (0.5 - groundY)
    }

    for (const d of this.wellDecorSprites) {
      d.glow.position.copy(d.main.position)
      d.sparkle.position.copy(d.main.position)
      d.sparkle.position.y += 0.02
      d.glow.scale.copy(d.main.scale).multiplyScalar(1.08)
      d.sparkle.scale.copy(d.main.scale).multiplyScalar(0.5)
    }
  }

  private syncWellSparkleFrame(state: GameState) {
    if (!this.wellDecorSprites.length || !this.wellSparkleMat || this.wellSparkleTextures.length === 0) return
    const i = Math.floor(state.nowMs / 280) % this.wellSparkleTextures.length
    const next = this.wellSparkleTextures[i]!
    if (this.wellSparkleMat.map !== next) {
      this.wellSparkleMat.map = next
      this.wellSparkleMat.needsUpdate = true
    }
  }

  /** Normalized pivot from bottom of texture (same convention as `npcGroundY_*`). */
  private getPoiGroundYForKind(state: GameState, kind: PoiKind) {
    if (kind === 'Well') return state.render.poiGroundY_Well
    if (kind === 'Chest') return state.render.poiGroundY_Chest
    return state.render.npcGroundY_Wurglepup
  }

  private getNpcSpriteMat(kind: NpcKind): THREE.SpriteMaterial {
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

    this.npcSpriteBaseTex[kind] = tex
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    this.npcSpriteMats[kind] = mat
    return mat
  }

  private ensureNpcIdleTexture(kind: NpcKind, src: string): THREE.Texture | null {
    const existing = this.npcIdleTextures[kind]
    if (existing) return existing
    const tex = this.textureLoader.load(src, () => {
      tex.needsUpdate = true
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.npcIdleTextures[kind] = tex
    return tex
  }

  private syncNpcIdleFrames(state: GameState) {
    for (const kind of Object.keys(NPC_SPRITE_IDLE_SRC) as NpcKind[]) {
      const idleSrc = NPC_SPRITE_IDLE_SRC[kind]
      if (!idleSrc) continue
      const mat = this.npcSpriteMats[kind]
      const base = this.npcSpriteBaseTex[kind]
      if (!mat || !base) continue
      const idleTex = this.ensureNpcIdleTexture(kind, idleSrc)
      if (!idleTex) continue
      const periodMs = 2000
      const phase = (state.nowMs % periodMs) / periodMs
      const useIdle = phase >= 0.58
      const next = useIdle ? idleTex : base
      if (mat.map !== next) {
        mat.map = next
        mat.needsUpdate = true
      }
    }
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

  private getNpcGroundYForKind(state: GameState, kind: NpcKind) {
    if (kind === 'Wurglepup') return state.render.npcGroundY_Wurglepup
    if (kind === 'Bobr') return state.render.npcGroundY_Bobr
    if (kind === 'Skeleton') return state.render.npcGroundY_Skeleton
    return state.render.npcGroundY_Catoctopus
  }

  private getNpcSizeForKind(state: GameState, kind: NpcKind, npcId: string) {
    const base = this.getNpcBaseSizeForKind(state, kind)
    const randPct = this.getNpcSizeRandForKind(state, kind)
    const signed = this.signedUnitFromStr(`npcSize:${state.floor.seed}:${kind}:${npcId}`)
    const factor = 1 + signed * randPct
    return Math.max(0.05, base * factor)
  }

  private getNpcBaseSizeForKind(state: GameState, kind: NpcKind) {
    if (kind === 'Wurglepup') return state.render.npcSize_Wurglepup
    if (kind === 'Bobr') return state.render.npcSize_Bobr
    if (kind === 'Skeleton') return state.render.npcSize_Skeleton
    return state.render.npcSize_Catoctopus
  }

  private getNpcSizeRandForKind(state: GameState, kind: NpcKind) {
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

  private disposeProcgenDebugOverlay() {
    if (!this.procgenDebugGroup) return
    this.scene.remove(this.procgenDebugGroup)
    const seenGeom = new Set<THREE.BufferGeometry>()
    this.procgenDebugGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry && !seenGeom.has(mesh.geometry)) {
        seenGeom.add(mesh.geometry)
        mesh.geometry.dispose()
      }
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
      else mat?.dispose?.()
    })
    this.procgenDebugGroup = null
  }

  private syncProcgenDebugOverlay(state: GameState) {
    const mode = state.ui.procgenDebugOverlay
    const { w, h, tiles } = state.floor
    const gen = state.floor.gen
    const key = `${mode ?? ''}|${w}|${h}|${tiles.join('')}|${gen?.meta?.inputSeed ?? 0}|${gen?.meta?.attempt ?? 0}|${gen?.missionGraph?.nodes?.length ?? 0}`
    if (key === this.lastProcgenDebugKey) return

    this.disposeProcgenDebugOverlay()
    this.lastProcgenDebugKey = key

    if (!mode || !gen?.rooms?.length) return

    const group = new THREE.Group()
    const findRoomAt = (gx: number, gy: number): GenRoom | undefined =>
      gen.rooms.find(
        (r) => gx >= r.rect.x && gx < r.rect.x + r.rect.w && gy >= r.rect.y && gy < r.rect.y + r.rect.h,
      )

    if (mode === 'districts') {
      const colors: Record<DistrictTag, string> = {
        NorthWing: '#5ad65a',
        SouthWing: '#d65a8e',
        EastWing: '#5a8ed6',
        WestWing: '#d6b05a',
        Core: '#9a5aff',
        Ruin: '#888888',
      }
      const planeGeo = new THREE.PlaneGeometry(0.9, 0.9)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = tiles[x + y * w]
          if (t !== 'floor' && t !== 'door' && t !== 'lockedDoor') continue
          const room = findRoomAt(x, y)
          const tag = room?.district ?? 'Core'
          const hex = colors[tag] ?? '#6688aa'
          const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(hex),
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
          })
          const mesh = new THREE.Mesh(planeGeo, mat)
          mesh.rotation.x = -Math.PI / 2
          mesh.position.set(x - w / 2, 0.03, y - h / 2)
          group.add(mesh)
        }
      }
    } else if (mode === 'roomTags') {
      const funcColors: Record<string, string> = {
        Passage: '#8899aa',
        Habitat: '#44aa66',
        Workshop: '#cc8844',
        Communal: '#8877cc',
        Storage: '#aa6666',
      }
      const planeGeo = new THREE.PlaneGeometry(0.9, 0.9)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = tiles[x + y * w]
          if (t !== 'floor' && t !== 'door' && t !== 'lockedDoor') continue
          const room = findRoomAt(x, y)
          const rf = room?.tags?.roomFunction
          const hex = (rf && funcColors[rf]) || '#445566'
          const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(hex),
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
          })
          const mesh = new THREE.Mesh(planeGeo, mat)
          mesh.rotation.x = -Math.PI / 2
          mesh.position.set(x - w / 2, 0.03, y - h / 2)
          group.add(mesh)
        }
      }
    } else if (mode === 'mission' && gen.missionGraph?.nodes) {
      const roleColor: Record<string, string> = {
        Entrance: '#00ff88',
        Exit: '#ff4488',
        Well: '#44aaff',
        Bed: '#ffcc44',
        Chest: '#ccaa44',
        LockGate: '#ff2222',
        KeyPickup: '#ffff44',
      }
      const boxGeo = new THREE.BoxGeometry(0.35, 0.08, 0.35)
      for (const n of gen.missionGraph.nodes) {
        const hex = roleColor[n.role] ?? '#ffffff'
        const mat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(hex),
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(boxGeo, mat)
        mesh.position.set(n.pos.x - w / 2, 0.12, n.pos.y - h / 2)
        group.add(mesh)
      }
    }

    this.procgenDebugGroup = group
    this.scene.add(group)
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

