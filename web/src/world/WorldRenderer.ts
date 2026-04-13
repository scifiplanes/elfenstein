import * as THREE from 'three'
import { shakeEnvelopeFactor } from '../game/shakeEnvelope'
import type { ContentDB, PlayerLightTag } from '../game/content/contentDb'
import { renderItemEmojiIconToCanvas } from '../game/renderItemEmojiIconCanvas'
import type { GameState, ItemId, NpcKind, PoiKind } from '../game/types'
import type { DistrictTag, GenRoom } from '../procgen/types'
import type { FloorType } from '../procgen/types'
import {
  DOOR_OCTOPUS_OPEN_FRAME_MS,
  isAnyDoorTile,
  isOctopusDoorTile,
  isPassableOpenDoorTile,
} from '../game/tiles'
import { getDungeonEnvTextureSrcs, OVERGROWN_ENV_TEXTURE_SRCS } from './dungeonEnvTextures'
import { isProceduralDungeonEnvFloorType, makeProceduralDungeonEnvTextures } from './dungeonEnvProceduralTextures'
import {
  getNpcWorldEmojiPlaceholder,
  NPC_SPRITE_IDLE_SRC,
  NPC_SPRITE_SRC,
  NPC_SPRITE_TINT_HEX,
} from '../game/npc/npcDefs'
import {
  POI_CAMPFIRE_EMOJI,
  POI_CRACKED_WALL_EMOJI,
  POI_KURATKO_NEST_EMOJI_EMPTY,
  POI_KURATKO_NEST_EMOJI_WITH_EGGS,
  POI_OPENED_SPRITE_SRC,
  POI_SPRITE_SRC,
  POI_WELL_DRAINED_SRC,
  POI_WELL_GLOW_SRC,
  POI_WELL_SPARKLE_FRAMES,
} from '../game/poi/poiDefs'
import {
  ALL_ROOM_HAZARD_PROPERTIES,
  isRoomHazardDecalProp,
  type RoomHazardProperty,
} from '../game/world/hazardDefs'
import { ROOM_HAZARD_SPRITE_SRC, shouldPlaceHazardDecal } from '../game/world/hazardDefs'
import { bossVisualScale } from '../game/content/npcBosses'
import {
  effectiveMergedPlayerLightDistance,
  glowbugMulForInventory,
  resolvePartyPlayerLightAggregate,
  type PartyPlayerLightThemeMults,
} from '../game/state/playerLight'
import { getThemeLightIntent } from './themeTuning'
import { resolveWorldPickHit } from './resolveWorldPickHit'
import { applyElderDistortionUniforms, createElderDistortionMaterial } from './elderDistortionBillboard'

const TAU = Math.PI * 2

function partyPlayerLightThemeMultsForState(state: GameState): PartyPlayerLightThemeMults {
  const intent = getThemeLightIntent(state.floor.gen?.theme?.id)
  return {
    lanternIntensityMult: intent.lanternIntensityMult ?? 1.0,
    torchIntensityMult: intent.torchIntensityMult ?? 1.0,
  }
}

/** Per-POI phase so multiple campfires do not flicker in lockstep. */
function campfireFlickerPhaseRad(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)!
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10_000) / 10_000 * TAU
}

/** World-space height for room-hazard floor decals (`hazard_*.png`). */
const HAZARD_DECAL_HEIGHT = 0.45
/** Y offset above floor plane (ground-stain read). */
const HAZARD_DECAL_FLOOR_Y = 0.08
/** World Y of dropped floor-item billboard center (sprite default pivot is texture center). */
const FLOOR_ITEM_SPRITE_CENTER_Y = 0.18

/** Matches dungeon floor emissive (`buildGeometry`) so lit billboards stay readable in dim cells. */
const LIT_BILLBOARD_EMISSIVE_HEX = 0x101018

function createLitBillboardLambertMaterial(map: THREE.Texture | null): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    map: map ?? undefined,
    color: new THREE.Color(0xffffff),
    emissive: new THREE.Color(LIT_BILLBOARD_EMISSIVE_HEX),
    emissiveIntensity: 0,
    transparent: true,
    depthWrite: false,
  })
}

const DOOR_CLOSED_SRC = '/content/door_closed.png'
const DOOR_OPEN_SRC = '/content/door_open.png'
const DOOR_OCTOPUS_CLOSED_SRC = '/content/door_octopus_closed.png'
const DOOR_OCTOPUS_OPEN_FRAMES = [
  '/content/door_octopus_opening_01.png',
  '/content/door_octopus_opening_02.png',
  '/content/door_octopus_opening_03.png',
] as const

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
  // Keep the best N without sorting the entire array (N is tiny; avoids per-frame alloc/GC).
  const best: Array<{ p: T; d: number }> = []
  for (let i = 0; i < pois.length; i++) {
    const p = pois[i]!
    const d = Math.abs(p.pos.x - px) + Math.abs(p.pos.y - py)
    if (best.length < max) {
      best.push({ p, d })
      // insertion-sort step
      for (let j = best.length - 1; j > 0 && best[j]!.d < best[j - 1]!.d; j--) {
        const tmp = best[j - 1]!
        best[j - 1] = best[j]!
        best[j] = tmp
      }
      continue
    }
    if (d >= best[best.length - 1]!.d) continue
    best[best.length - 1] = { p, d }
    for (let j = best.length - 1; j > 0 && best[j]!.d < best[j - 1]!.d; j--) {
      const tmp = best[j - 1]!
      best[j - 1] = best[j]!
      best[j] = tmp
    }
  }
  return best.map((x) => x.p)
}

type FloorPlayerLightPick = {
  pos: { x: number; y: number }
  jitter: { x: number; z: number }
  tag: PlayerLightTag
  glowbugMul: number
}

/** Nearest floor items that emit `playerLight` (Manhattan on grid), capped at `max`. */
function nearestFloorPlayerLightItems(state: GameState, content: ContentDB, max: number): FloorPlayerLightPick[] {
  if (max <= 0 || state.floor.itemsOnFloor.length === 0) return []
  const px = state.floor.playerPos.x
  const py = state.floor.playerPos.y
  const best: Array<{ row: FloorPlayerLightPick; d: number }> = []
  for (const it of state.floor.itemsOnFloor) {
    const inv = state.party.items[it.id]
    if (!inv) continue
    const tag = content.item(inv.defId).playerLight
    if (!tag) continue
    const glowbugMul = tag === 'glowbug' ? glowbugMulForInventory(inv) : 1
    const d = Math.abs(it.pos.x - px) + Math.abs(it.pos.y - py)
    const row: FloorPlayerLightPick = {
      pos: it.pos,
      jitter: { x: it.jitter?.x ?? 0, z: it.jitter?.z ?? 0 },
      tag,
      glowbugMul,
    }
    if (best.length < max) {
      best.push({ row, d })
      for (let j = best.length - 1; j > 0 && best[j]!.d < best[j - 1]!.d; j--) {
        const tmp = best[j - 1]!
        best[j - 1] = best[j]!
        best[j] = tmp
      }
      continue
    }
    if (d >= best[best.length - 1]!.d) continue
    best[best.length - 1] = { row, d }
    for (let j = best.length - 1; j > 0 && best[j]!.d < best[j - 1]!.d; j--) {
      const tmp = best[j - 1]!
      best[j - 1] = best[j]!
      best[j] = tmp
    }
  }
  return best.map((x) => x.row)
}

function floorItemPlayerLightBase(
  tag: PlayerLightTag,
  state: GameState,
  glowbugMul: number,
  globalI: number,
  lanternThemeMult: number,
  torchThemeMult: number,
): { intensity: number; distance: number } {
  switch (tag) {
    case 'torch':
      return {
        intensity: state.render.heldTorchIntensity * 0.42 * torchThemeMult * globalI,
        distance: state.render.heldTorchDistance * 0.88,
      }
    case 'lantern':
      return {
        intensity: state.render.equippedLanternIntensity * 0.3 * lanternThemeMult * globalI,
        distance: state.render.equippedLanternDistance * 0.68,
      }
    case 'headlamp': {
      const headM = Math.max(lanternThemeMult, torchThemeMult)
      return {
        // Match torch floor scale (0.42); headlamp used 0.36 + lantern-only theme and read weaker.
        intensity: state.render.headlampIntensity * 0.42 * headM * globalI,
        distance: state.render.headlampDistance * 0.55,
      }
    }
    case 'glowbug': {
      const distMul = Math.sqrt(glowbugMul)
      return {
        intensity: state.render.glowbugIntensity * 0.52 * lanternThemeMult * globalI * glowbugMul,
        distance: state.render.glowbugDistance * 0.88 * distMul,
      }
    }
  }
}

export class WorldRenderer {
  private readonly renderer: THREE.WebGLRenderer
  private rt: THREE.WebGLRenderTarget | null = null
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly lantern: THREE.PointLight
  private readonly torchLights: THREE.PointLight[] = []
  private lastTorchPickKey = ''
  private cachedTorchPicked: Array<{ pos: { x: number; y: number } }> = []

  private readonly floorPlayerLights: THREE.PointLight[] = []
  private lastFloorPlayerLightKey = ''
  private cachedFloorPlayerLightPicked: FloorPlayerLightPick[] = []

  private expFog: THREE.FogExp2 | null = null
  private lastShadowMapSize = 0
  private lastShadowFilter: THREE.ShadowMapType | null = null

  private lastSize = { w: 0, h: 0 }
  private lastCamFov = NaN
  private lastFloorGeomRevision = -1
  private geoGroup: THREE.Group | null = null
  private pickables: THREE.Object3D[] = []
  private readonly raycaster = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()

  private floorMat: THREE.MeshLambertMaterial | null = null
  private wallMat: THREE.MeshLambertMaterial | null = null
  private ceilMat: THREE.MeshLambertMaterial | null = null

  private overgrownFloorMat: THREE.MeshLambertMaterial | null = null
  private overgrownWallMat: THREE.MeshLambertMaterial | null = null
  private overgrownCeilMat: THREE.MeshLambertMaterial | null = null

  private readonly envTex: Partial<Record<FloorType, { floor: THREE.Texture; wall: THREE.Texture; ceiling: THREE.Texture }>> =
    {}
  private overgrownEnvTex: { floor: THREE.Texture; wall: THREE.Texture; ceiling: THREE.Texture } | null = null

  private readonly textureLoader = new THREE.TextureLoader()
  /** NPC base + idle PNGs keyed by URL so kinds sharing art (e.g. Grub variants) load once. */
  private readonly npcLoaderTexturesByUrl = new Map<string, THREE.Texture>()
  /** Shared by floor-item billboards; disposed in `dispose()`. Do not dispose maps in `disposeGeoGroupResources`. */
  private readonly floorItemIconTextures = new Map<string, THREE.Texture>()
  /** XY plane, centered pivot (matches NPC/door/floor-item/hazard billboards). */
  private readonly litBillboardPlaneGeoCenter: THREE.PlaneGeometry
  /** XY plane, bottom edge at local y=0 (matches POI `Sprite.center` 0.5,0). */
  private readonly litBillboardPlaneGeoPoi: THREE.PlaneGeometry
  private readonly npcBillboardMats: Partial<Record<NpcKind, THREE.MeshLambertMaterial>> = {}
  private readonly npcSpriteAspects: Partial<Record<NpcKind, number>> = {}
  private readonly npcSpriteBaseTex: Partial<Record<NpcKind, THREE.Texture>> = {}
  private readonly npcIdleTextures: Partial<Record<NpcKind, THREE.Texture>> = {}
  private npcBillboards: Array<
    | { mode: 'billboard'; object: THREE.Mesh; id: string; kind: NpcKind }
    | { mode: 'elder'; object: THREE.Mesh; id: string; kind: NpcKind }
    | { mode: 'emoji'; object: THREE.Mesh; id: string; kind: NpcKind }
  > = []
  /** Shared by all Elder procedural meshes; disposed in `dispose()`. */
  private elderDistortionMat: THREE.ShaderMaterial | null = null

  private readonly poiBillboardMats: Partial<Record<PoiKind, THREE.MeshLambertMaterial>> = {}
  private readonly poiOpenedBillboardMats: Partial<Record<PoiKind, THREE.MeshLambertMaterial>> = {}
  private readonly poiSpriteAspects: Partial<Record<PoiKind, number>> = {}
  private poiBillboards: Array<{ mesh: THREE.Mesh; id: string; kind: PoiKind }> = []
  private lastPoiSpriteBoost = NaN
  private lastNpcSpriteBoost = NaN
  private themeSpriteColor = new THREE.Color('#ffffff')
  private readonly tmpHsl = { h: 0, s: 0, l: 0 }

  private wellDrainedMat: THREE.MeshLambertMaterial | null = null
  private wellGlowMat: THREE.SpriteMaterial | null = null
  private wellSparkleMat: THREE.SpriteMaterial | null = null
  private wellSparkleTextures: THREE.Texture[] = []
  private wellDecorSprites: Array<{ main: THREE.Mesh; glow: THREE.Sprite; sparkle: THREE.Sprite }> = []

  private doorClosedMat: THREE.MeshLambertMaterial | null = null
  private doorOctopusClosedMat: THREE.MeshLambertMaterial | null = null
  private doorOpenMat: THREE.MeshLambertMaterial | null = null
  /** Last frame of octopus opening strip; static open billboard on `doorOpenOctopus` tiles. */
  private doorOctopusOpenStaticMat: THREE.MeshLambertMaterial | null = null
  private doorOpenOctopusTextures: THREE.Texture[] = []
  private doorFxTracked: Array<{
    id: string
    mesh: THREE.Mesh
    visual: 'wooden' | 'octopus'
    startedAtMs: number
    /** Grid cell (same as `DoorOpenFx.pos`) for world XZ each frame. */
    cellX: number
    cellY: number
  }> = []

  private readonly hazardDecalMats: Partial<Record<RoomHazardProperty, THREE.MeshLambertMaterial>> = {}
  private readonly hazardDecalAspects: Partial<Record<RoomHazardProperty, number>> = {}
  private hazardDecalMeshes: Array<{ mesh: THREE.Mesh; prop: RoomHazardProperty }> = []

  private doorFxGroup: THREE.Group | null = null
  private lastDoorFxKey = ''

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
    // World-anchored for non-headlamp; `syncScene` reparents for headlamp.
    this.scene.add(this.lantern)

    this.litBillboardPlaneGeoCenter = new THREE.PlaneGeometry(1, 1)
    this.litBillboardPlaneGeoPoi = new THREE.PlaneGeometry(1, 1)
    this.litBillboardPlaneGeoPoi.translate(0, 0.5, 0)

    this.syncSize(1, 1)
  }

  dispose() {
    for (const t of this.npcLoaderTexturesByUrl.values()) {
      t.dispose()
    }
    this.npcLoaderTexturesByUrl.clear()
    for (const m of Object.values(this.npcBillboardMats)) {
      if (!m) continue
      m.map = null
      m.dispose()
    }
    for (const m of Object.values(this.poiBillboardMats)) {
      if (!m) continue
      m.map?.dispose()
      m.dispose()
    }
    for (const m of Object.values(this.poiOpenedBillboardMats)) {
      if (!m) continue
      m.map?.dispose()
      m.dispose()
    }
    if (this.wellDrainedMat) {
      this.wellDrainedMat.map?.dispose()
      this.wellDrainedMat.dispose()
      this.wellDrainedMat = null
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
    if (this.doorClosedMat) {
      this.doorClosedMat.map?.dispose()
      this.doorClosedMat.dispose()
      this.doorClosedMat = null
    }
    if (this.doorOctopusClosedMat) {
      this.doorOctopusClosedMat.map?.dispose()
      this.doorOctopusClosedMat.dispose()
      this.doorOctopusClosedMat = null
    }
    if (this.doorOctopusOpenStaticMat) {
      // Map may be shared with `doorOpenOctopusTextures[n-1]`; dispose textures once in the array loop below.
      this.doorOctopusOpenStaticMat.map = null
      this.doorOctopusOpenStaticMat.dispose()
      this.doorOctopusOpenStaticMat = null
    }
    if (this.doorOpenMat) {
      this.doorOpenMat.map?.dispose()
      this.doorOpenMat.dispose()
      this.doorOpenMat = null
    }
    for (const t of this.doorOpenOctopusTextures) t.dispose()
    this.doorOpenOctopusTextures = []
    for (const prop of ['Burning', 'Flooded', 'Infected'] as const) {
      const m = this.hazardDecalMats[prop]
      if (!m) continue
      m.map?.dispose()
      m.dispose()
      delete this.hazardDecalMats[prop]
    }
    for (const t of this.wellSparkleTextures) t.dispose()
    this.wellSparkleTextures = []
    for (const bundle of Object.values(this.envTex)) {
      if (!bundle) continue
      bundle.floor.dispose()
      bundle.wall.dispose()
      bundle.ceiling.dispose()
    }
    Object.keys(this.envTex).forEach((k) => delete this.envTex[k as FloorType])
    if (this.overgrownEnvTex) {
      this.overgrownEnvTex.floor.dispose()
      this.overgrownEnvTex.wall.dispose()
      this.overgrownEnvTex.ceiling.dispose()
      this.overgrownEnvTex = null
    }
    this.geoGroup?.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        const g = mesh.geometry
        if (
          g &&
          g !== this.litBillboardPlaneGeoCenter &&
          g !== this.litBillboardPlaneGeoPoi
        ) {
          g.dispose()
        }
        const itemUd = mesh.userData as { disposableItemIcon?: boolean }
        const mat = mesh.material
        if (Array.isArray(mat)) {
          for (const m of mat) {
            if (m === this.elderDistortionMat) continue
            m?.dispose()
          }
        } else if (mat && mat !== this.elderDistortionMat) {
          if (itemUd.disposableItemIcon) {
            const lm = mat as THREE.MeshLambertMaterial
            const map = lm.map
            if (map instanceof THREE.CanvasTexture) map.dispose()
          }
          mat.dispose()
        }
        return
      }
      const sprite = obj as THREE.Sprite
      if (!sprite.isSprite) return
      const ud = sprite.userData as { disposableItemIcon?: boolean }
      if (!ud.disposableItemIcon) return
      const sm = sprite.material as THREE.SpriteMaterial
      const map = sm.map
      if (map instanceof THREE.CanvasTexture) map.dispose()
      sm.dispose()
    })
    for (const t of this.floorItemIconTextures.values()) {
      t.dispose()
    }
    this.floorItemIconTextures.clear()
    if (this.elderDistortionMat) {
      this.elderDistortionMat.dispose()
      this.elderDistortionMat = null
    }
    this.litBillboardPlaneGeoCenter.dispose()
    this.litBillboardPlaneGeoPoi.dispose()
    this.rt?.dispose()
    this.rt = null
    this.lastSize = { w: 0, h: 0 }
    if (this.doorFxGroup) {
      this.doorFxGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        const mat = mesh.material as THREE.MeshLambertMaterial | undefined
        if (!mat || !mesh.isMesh) return
        if (mat !== this.doorOpenMat) {
          mat.map = null
          mat.dispose()
        }
      })
      this.scene.remove(this.doorFxGroup)
    }
    this.doorFxGroup = null
    this.doorFxTracked = []
    this.lastDoorFxKey = ''
    while (this.torchLights.length) {
      const l = this.torchLights.pop()!
      this.scene.remove(l)
      ;(l as unknown as { dispose?: () => void }).dispose?.()
    }
    while (this.floorPlayerLights.length) {
      const l = this.floorPlayerLights.pop()!
      this.scene.remove(l)
      ;(l as unknown as { dispose?: () => void }).dispose?.()
    }
    const lanternParent = this.lantern.parent
    if (lanternParent) lanternParent.remove(this.lantern)
    ;(this.lantern as unknown as { dispose?: () => void }).dispose?.()
    this.disposeProcgenDebugOverlay()
  }

  /** Ensure the offscreen buffer matches the game viewport in layout CSS px (ignores ancestor `transform: scale`). */
  syncViewportRect(cssLayoutWidth: number, cssLayoutHeight: number, pixelRatioCap: number) {
    // Browser zoom changes `devicePixelRatio`; compensate using `visualViewport.scale` so
    // the render target stays consistent with compositor pixel math across zoom levels.
    const vvScale = window.visualViewport?.scale || 1
    const effectiveDpr = (window.devicePixelRatio || 1) / Math.max(1e-6, vvScale)
    const cap = Math.max(1, Math.min(1.5, pixelRatioCap))
    const capped = Math.min(effectiveDpr, cap)
    const w = Math.max(1, Math.floor(cssLayoutWidth * capped))
    const h = Math.max(1, Math.floor(cssLayoutHeight * capped))
    this.syncSize(w, h)
  }

  renderFrame(state: GameState, content: ContentDB) {
    this.syncScene(state, content)
    this.syncTuning(state, content)
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
    state: GameState,
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
    const hit = resolveWorldPickHit(hits, state.floor.tiles, state.floor.w)
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
    state: GameState,
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
    const hit = resolveWorldPickHit(hits, state.floor.tiles, state.floor.w)
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

  private syncScene(state: GameState, content: ContentDB) {
    const rev = state.floor.floorGeomRevision ?? 0
    if (rev !== this.lastFloorGeomRevision) {
      this.lastFloorGeomRevision = rev
      if (this.geoGroup) {
        disposeGeoGroupResources(this.geoGroup)
        this.scene.remove(this.geoGroup)
      }
      this.geoGroup = this.buildGeometry(state, content)
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
    this.syncDoorFx(state)

    const plAgg = resolvePartyPlayerLightAggregate(state, content, partyPlayerLightThemeMultsForState(state))
    this.ensurePrimaryPlayerLightParent(plAgg.anyHeadlamp)
    if (plAgg.anyHeadlamp) {
      this.lantern.position.set(0, state.render.lanternVerticalOffset, -state.render.lanternForwardOffset)
    } else {
      const fw = state.floor.w
      const fh = state.floor.h
      const wx = state.floor.playerPos.x - fw / 2
      const wz = state.floor.playerPos.y - fh / 2
      const fwd = state.render.lanternForwardOffset
      const fx = Math.sin(yawGame)
      const fz = -Math.cos(yawGame)
      const worldY = state.view.camPos.y + state.render.lanternVerticalOffset
      this.lantern.position.set(wx + fx * fwd, worldY, wz + fz * fwd)
    }
  }

  /** Headlamp stays on the camera; other primary lights sit in world space (grid + yaw, not pitch). */
  private ensurePrimaryPlayerLightParent(anyHeadlampEquipped: boolean) {
    const wantCamera = anyHeadlampEquipped
    const onCamera = this.lantern.parent === this.camera
    if (wantCamera === onCamera) return
    if (wantCamera) {
      this.scene.remove(this.lantern)
      this.camera.add(this.lantern)
    } else {
      this.camera.remove(this.lantern)
      this.scene.add(this.lantern)
    }
  }

  /** Clamped index into `DOOR_OCTOPUS_OPEN_FRAMES` / `doorOpenOctopusTextures`. */
  private doorOctopusOpeningFrameIndex(nowMs: number, startedAtMs: number): number {
    const n = DOOR_OCTOPUS_OPEN_FRAMES.length
    const elapsed = Math.max(0, nowMs - startedAtMs)
    return Math.min(n - 1, Math.floor(elapsed / DOOR_OCTOPUS_OPEN_FRAME_MS))
  }

  private syncDoorFx(state: GameState) {
    const active = (state.ui.doorOpenFx ?? [])
      .filter((fx) => fx.untilMs > state.nowMs)
      .sort((a, b) => a.id.localeCompare(b.id))
    const key = active.map((fx) => fx.id).join('|')
    const trackedMatches =
      active.length === this.doorFxTracked.length &&
      active.every((fx, i) => this.doorFxTracked[i]?.id === fx.id)

    if (key !== this.lastDoorFxKey || !trackedMatches) {
      this.lastDoorFxKey = key
      if (this.doorFxGroup) {
        this.doorFxGroup.traverse((obj) => {
          const mesh = obj as THREE.Mesh
          const mat = mesh.material as THREE.MeshLambertMaterial | undefined
          if (!mat || !mesh.isMesh) return
          if (mat !== this.doorOpenMat) {
            mat.map = null
            mat.dispose()
          }
        })
        this.scene.remove(this.doorFxGroup)
      }
      this.doorFxGroup = null
      this.doorFxTracked = []

      if (active.length > 0) {
        const g = new THREE.Group()
        const w = state.floor.w
        const h = state.floor.h
        const octoTex = this.ensureDoorOctopusOpenTextures()
        for (const fx of active) {
          const x = fx.pos.x - w / 2
          const z = fx.pos.y - h / 2
          const visual = fx.visual === 'octopus' ? 'octopus' : 'wooden'
          let mat: THREE.MeshLambertMaterial
          if (visual === 'octopus' && octoTex.length >= DOOR_OCTOPUS_OPEN_FRAMES.length) {
            const fi = this.doorOctopusOpeningFrameIndex(state.nowMs, fx.startedAtMs)
            mat = createLitBillboardLambertMaterial(octoTex[fi]!)
          } else {
            mat = this.getDoorOpenMat()
          }
          const mesh = new THREE.Mesh(this.litBillboardPlaneGeoCenter, mat)
          mesh.position.set(x, 0.55, z)
          mesh.castShadow = false
          mesh.receiveShadow = false
          g.add(mesh)
          this.doorFxTracked.push({
            id: fx.id,
            mesh,
            visual,
            startedAtMs: fx.startedAtMs,
            cellX: fx.pos.x,
            cellY: fx.pos.y,
          })
        }
        this.doorFxGroup = g
        this.scene.add(g)
      }
    }

    const octoTex = this.doorOpenOctopusTextures
    const nOcto = DOOR_OCTOPUS_OPEN_FRAMES.length
    for (const entry of this.doorFxTracked) {
      if (entry.visual !== 'octopus' || octoTex.length < nOcto) continue
      const mat = entry.mesh.material as THREE.MeshLambertMaterial
      const srcFx = active.find((f) => f.id === entry.id)
      const startedAtMs = srcFx?.startedAtMs ?? entry.startedAtMs
      const frame = this.doorOctopusOpeningFrameIndex(state.nowMs, startedAtMs)
      const tex = octoTex[frame]!
      if (mat.map !== tex) {
        mat.map = tex
        mat.needsUpdate = true
      }
    }
  }

  private ensureDoorOctopusOpenTextures(): THREE.Texture[] {
    if (this.doorOpenOctopusTextures.length >= DOOR_OCTOPUS_OPEN_FRAMES.length) return this.doorOpenOctopusTextures
    for (const src of DOOR_OCTOPUS_OPEN_FRAMES) {
      const tex = this.textureLoader.load(src)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.NearestFilter
      tex.magFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      this.doorOpenOctopusTextures.push(tex)
    }
    return this.doorOpenOctopusTextures
  }

  private getFloorItemIconTexture(path: string): THREE.Texture {
    const hit = this.floorItemIconTextures.get(path)
    if (hit) return hit
    const tex = this.textureLoader.load(path)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    this.floorItemIconTextures.set(path, tex)
    return tex
  }

  private configureDungeonEnvTexture(tex: THREE.Texture) {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(1, 1)
  }

  private configureProceduralDungeonEnvTexture(tex: THREE.DataTexture) {
    this.configureDungeonEnvTexture(tex)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
  }

  private getEnvTexturesForFloorType(floorType: FloorType): { floor: THREE.Texture; wall: THREE.Texture; ceiling: THREE.Texture } {
    if (floorType === 'Jungle') {
      return this.getOvergrownEnvTextures()
    }

    const cached = this.envTex[floorType]
    if (cached) return cached

    if (isProceduralDungeonEnvFloorType(floorType)) {
      const bundle = makeProceduralDungeonEnvTextures(floorType)
      for (const tex of [bundle.floor, bundle.wall, bundle.ceiling]) {
        this.configureProceduralDungeonEnvTexture(tex)
      }
      this.envTex[floorType] = bundle
      return bundle
    }

    const srcs = getDungeonEnvTextureSrcs(floorType)
    if (!srcs) {
      throw new Error(`getEnvTexturesForFloorType: missing PNG srcs for ${floorType}`)
    }
    const floor = this.textureLoader.load(srcs.floor)
    const wall = this.textureLoader.load(srcs.wall)
    const ceiling = this.textureLoader.load(srcs.ceiling)

    for (const tex of [floor, wall, ceiling]) {
      this.configureDungeonEnvTexture(tex)
    }

    const bundle = { floor, wall, ceiling }
    this.envTex[floorType] = bundle
    return bundle
  }

  private getOvergrownEnvTextures(): { floor: THREE.Texture; wall: THREE.Texture; ceiling: THREE.Texture } {
    if (this.overgrownEnvTex) return this.overgrownEnvTex

    const floor = this.textureLoader.load(OVERGROWN_ENV_TEXTURE_SRCS.floor)
    const wall = this.textureLoader.load(OVERGROWN_ENV_TEXTURE_SRCS.wall)
    const ceiling = this.textureLoader.load(OVERGROWN_ENV_TEXTURE_SRCS.ceiling)

    for (const tex of [floor, wall, ceiling]) {
      this.configureDungeonEnvTexture(tex)
    }

    this.overgrownEnvTex = { floor, wall, ceiling }
    return this.overgrownEnvTex
  }

  private buildGeometry(state: GameState, content: ContentDB) {
    const g = new THREE.Group()
    this.pickables = []
    this.npcBillboards = []
    this.poiBillboards = []
    this.wellDecorSprites = []

    const env = this.getEnvTexturesForFloorType(state.floor.floorType)
    const wallTex = env.wall
    const floorTex = env.floor
    const ceilTex = env.ceiling

    const overgrownEnv = this.getOvergrownEnvTextures()
    const overgrownWallTex = overgrownEnv.wall
    const overgrownFloorTex = overgrownEnv.floor
    const overgrownCeilTex = overgrownEnv.ceiling

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

    this.overgrownFloorMat = new THREE.MeshLambertMaterial({
      map: overgrownFloorTex,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#101018'),
      emissiveIntensity: base * 1.0,
    })
    this.overgrownWallMat = new THREE.MeshLambertMaterial({
      map: overgrownWallTex,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#161210'),
      emissiveIntensity: base * 0.8,
    })
    this.overgrownCeilMat = new THREE.MeshLambertMaterial({
      map: overgrownCeilTex,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color('#05050a'),
      emissiveIntensity: base * 0.6,
    })

    const floorGeo = new THREE.BoxGeometry(1, 0.1, 1)
    const wallGeo = new THREE.BoxGeometry(1, 1.2, 1)
    const ceilGeo = new THREE.BoxGeometry(1, 0.1, 1)

    const { w, h, tiles } = state.floor

    // Overgrown env application: rooms tagged `roomStatus: 'Overgrown'` (bounded by `room.rect`)
    // are intersected with actual walkable tiles to avoid relying on rect semantics.
    const overgrownWalkable = new Set<number>()
    const rooms = state.floor.gen?.rooms as GenRoom[] | undefined
    if (rooms?.length) {
      for (const r of rooms) {
        if (r.tags?.roomStatus !== 'Overgrown') continue
        const { x: rx, y: ry, w: rw, h: rh } = r.rect
        for (let y = ry; y < ry + rh; y++) {
          for (let x = rx; x < rx + rw; x++) {
            if (x < 0 || y < 0 || x >= w || y >= h) continue
            const i = x + y * w
            const t = tiles[i]
            if (t === 'floor' || isAnyDoorTile(t) || isPassableOpenDoorTile(t)) overgrownWalkable.add(i)
          }
        }
      }
    }

    const wallTouchesOvergrown = (x: number, y: number) => {
      // Only meaningful for wall tiles, but safe for any coords.
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (overgrownWalkable.has(nx + ny * w)) return true
      }
      return false
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = x + y * w
        const t = tiles[idx]
        const wx = x - w / 2
        const wz = y - h / 2
        if (t === 'floor' || isPassableOpenDoorTile(t)) {
          const isOvergrown = overgrownWalkable.has(idx)
          const m = new THREE.Mesh(floorGeo, isOvergrown ? this.overgrownFloorMat : this.floorMat)
          m.position.set(wx, -0.05, wz)
          m.receiveShadow = true
          g.add(m)

          const c = new THREE.Mesh(ceilGeo, isOvergrown ? this.overgrownCeilMat : this.ceilMat)
          c.position.set(wx, 1.25, wz)
          c.receiveShadow = true
          g.add(c)

          if (isPassableOpenDoorTile(t)) {
            const openMat = t === 'doorOpenOctopus' ? this.getDoorOctopusOpenStaticMat() : this.getDoorOpenMat()
            const d = new THREE.Mesh(this.litBillboardPlaneGeoCenter, openMat)
            d.position.set(wx, 0.55, wz)
            d.castShadow = false
            d.receiveShadow = false
            const doorVisual = t === 'doorOpenOctopus' ? 'octopus' : 'wooden'
            d.userData = { kind: 'door', doorVisual, id: `${x},${y}`, baseX: wx, baseZ: wz }
            g.add(d)
            this.pickables.push(d)
          }
        } else if (isAnyDoorTile(t)) {
          const isOvergrown = overgrownWalkable.has(idx)
          // Door occupies a floor tile position.
          const m = new THREE.Mesh(floorGeo, isOvergrown ? this.overgrownFloorMat : this.floorMat)
          m.position.set(wx, -0.05, wz)
          m.receiveShadow = true
          g.add(m)

          const c = new THREE.Mesh(ceilGeo, isOvergrown ? this.overgrownCeilMat : this.ceilMat)
          c.position.set(wx, 1.25, wz)
          c.receiveShadow = true
          g.add(c)

          const doorMat = isOctopusDoorTile(t) ? this.getDoorOctopusClosedMat() : this.getDoorClosedMat()
          const d = new THREE.Mesh(this.litBillboardPlaneGeoCenter, doorMat)
          d.position.set(wx, 0.55, wz)
          d.castShadow = false
          d.receiveShadow = false
          const doorVisual = isOctopusDoorTile(t) ? 'octopus' : 'wooden'
          d.userData = { kind: 'door', doorVisual, id: `${x},${y}`, baseX: wx, baseZ: wz }
          g.add(d)
          this.pickables.push(d)
        } else {
          const m = new THREE.Mesh(wallGeo, wallTouchesOvergrown(x, y) ? this.overgrownWallMat : this.wallMat)
          m.position.set(wx, 0.55, wz)
          m.castShadow = true
          m.receiveShadow = true
          g.add(m)
        }
      }
    }

    this.hazardDecalMeshes = []
    const floorSeed = state.floor.seed
    const genRooms = state.floor.gen?.rooms
    if (genRooms?.length) {
      const occupied = new Set<string>()
      for (const p of state.floor.pois) occupied.add(`${p.pos.x},${p.pos.y}`)
      for (const n of state.floor.npcs) occupied.add(`${n.pos.x},${n.pos.y}`)
      for (const it of state.floor.itemsOnFloor) occupied.add(`${it.pos.x},${it.pos.y}`)

      for (const room of genRooms) {
        const prop = room.tags?.roomProperties
        if (!isRoomHazardDecalProp(prop)) continue
        const { x: rx, y: ry, w: rw, h: rh } = room.rect
        for (let y = ry; y < ry + rh; y++) {
          for (let x = rx; x < rx + rw; x++) {
            if (x < 0 || y < 0 || x >= w || y >= h) continue
            if (tiles[x + y * w] !== 'floor') continue
            const cellKey = `${x},${y}`
            if (occupied.has(cellKey)) continue
            if (!shouldPlaceHazardDecal({ floorSeed, roomId: room.id, prop, x, y })) continue
            const wx = x - w / 2
            const wz = y - h / 2
            const mat = this.getHazardDecalMat(prop)
            const mesh = new THREE.Mesh(this.litBillboardPlaneGeoCenter, mat)
            mesh.position.set(wx, HAZARD_DECAL_FLOOR_Y, wz)
            mesh.castShadow = false
            mesh.receiveShadow = false
            mesh.userData = { kind: 'hazardDecal' }
            g.add(mesh)
            this.hazardDecalMeshes.push({ mesh, prop })
          }
        }
      }
    }

    state.floor.pois.forEach((p) => {
      const x = p.pos.x - w / 2
      const z = p.pos.y - h / 2
      let mat: THREE.MeshLambertMaterial
      if (p.kind === 'KuratkoNest') {
        const glyph = p.opened ? POI_KURATKO_NEST_EMOJI_EMPTY : POI_KURATKO_NEST_EMOJI_WITH_EGGS
        mat = makeItemIconBillboardMaterial(glyph)
      } else if (p.kind === 'Campfire') {
        mat = makeItemIconBillboardMaterial(POI_CAMPFIRE_EMOJI)
        mat.opacity = 1
      } else if (p.kind === 'CrackedWall') {
        mat = makeItemIconBillboardMaterial(POI_CRACKED_WALL_EMOJI)
      } else if (p.kind === 'Well' && p.drained) {
        mat = this.getWellDrainedMat()
      } else if (p.opened && POI_OPENED_SPRITE_SRC[p.kind]) {
        mat = this.getPoiOpenedBillboardMat(p.kind)
      } else {
        mat = this.getPoiBillboardMat(p.kind)
      }
      const mesh = new THREE.Mesh(this.litBillboardPlaneGeoPoi, mat)
      mesh.position.set(x, 0, z)
      mesh.castShadow = false
      mesh.receiveShadow = false
      // Scale and floor grounding are applied in `syncTuning()` (bottom pivot + `poiFootLift`).
      mesh.userData =
        p.kind === 'KuratkoNest' || p.kind === 'Campfire' || p.kind === 'CrackedWall'
          ? { kind: 'poi', id: p.id, poiEmojiBillboard: true, disposableItemIcon: true }
          : { kind: 'poi', id: p.id }
      g.add(mesh)
      this.pickables.push(mesh)
      this.poiBillboards.push({ mesh, id: p.id, kind: p.kind })

      if (p.kind === 'Well' && !p.drained) {
        const ro = mesh.renderOrder
        const glow = new THREE.Sprite(this.getWellGlowMat())
        glow.center.set(0.5, 0)
        glow.position.set(x, 0, z)
        // Draw above the Lambert well base so the water glow is not occluded; sparkle stacks on top.
        glow.renderOrder = ro + 1
        const sparkle = new THREE.Sprite(this.getWellSparkleMat())
        sparkle.center.set(0.5, 0)
        sparkle.position.set(x, 0, z)
        sparkle.renderOrder = ro + 2
        g.add(glow)
        g.add(sparkle)
        this.wellDecorSprites.push({ main: mesh, glow, sparkle })
      }
    })

    state.floor.npcs.forEach((n) => {
      const x = n.pos.x - w / 2
      const z = n.pos.y - h / 2
      if (n.kind === 'Elder') {
        const mat = this.ensureElderDistortionMat()
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
        mesh.position.set(x, 0.38, z)
        mesh.userData = { kind: 'npc', id: n.id, elderProcedural: true }
        g.add(mesh)
        this.pickables.push(mesh)
        this.npcBillboards.push({ mode: 'elder', object: mesh, id: n.id, kind: n.kind })
      } else {
        const emoji = getNpcWorldEmojiPlaceholder(n.kind)
        if (emoji) {
          const mat = makeItemIconBillboardMaterial(emoji)
          const mesh = new THREE.Mesh(this.litBillboardPlaneGeoCenter, mat)
          mesh.position.set(x, 0.38, z)
          mesh.castShadow = false
          mesh.receiveShadow = false
          mesh.userData = { kind: 'npc', id: n.id, npcEmojiBillboard: true, disposableItemIcon: true }
          g.add(mesh)
          this.pickables.push(mesh)
          this.npcBillboards.push({ mode: 'emoji', object: mesh, id: n.id, kind: n.kind })
        } else {
          const mesh = new THREE.Mesh(this.litBillboardPlaneGeoCenter, this.getNpcBillboardMat(n.kind))
          mesh.position.set(x, 0.38, z)
          mesh.castShadow = false
          mesh.receiveShadow = false
          // Scale is applied in `syncTuning()` so it can react to debug tuning and texture load (aspect).
          mesh.userData = { kind: 'npc', id: n.id }
          g.add(mesh)
          this.pickables.push(mesh)
          this.npcBillboards.push({ mode: 'billboard', object: mesh, id: n.id, kind: n.kind })
        }
      }
    })

    state.floor.itemsOnFloor.forEach((it) => {
      const x = it.pos.x - w / 2 + (it.jitter?.x ?? 0)
      const z = it.pos.y - h / 2 + (it.jitter?.z ?? 0)
      const icon = resolveFloorItemIcon(state, content, it.id)
      const mat =
        icon.kind === 'emoji'
          ? makeItemIconBillboardMaterial(icon.glyph, {
              tintFilter: icon.tintFilter,
              displayScale: icon.displayScale,
              rotateDeg: icon.rotateDeg,
              flipHorizontal: icon.flipHorizontal,
              flipVertical: icon.flipVertical,
            })
          : createLitBillboardLambertMaterial(this.getFloorItemIconTexture(icon.path))
      const mesh = new THREE.Mesh(this.litBillboardPlaneGeoCenter, mat)
      mesh.position.set(x, FLOOR_ITEM_SPRITE_CENTER_Y, z)
      mesh.scale.set(0.5, 0.5, 1)
      mesh.castShadow = false
      mesh.receiveShadow = false
      mesh.userData = { kind: 'floorItem', id: it.id, disposableItemIcon: true, baseX: x, baseZ: z }
      g.add(mesh)
      this.pickables.push(mesh)
    })

    g.userData = {
      disposableBoxGeoms: [floorGeo, wallGeo, ceilGeo],
      disposableMeshMats: [
        this.floorMat!,
        this.wallMat!,
        this.ceilMat!,
        this.overgrownFloorMat!,
        this.overgrownWallMat!,
        this.overgrownCeilMat!,
      ],
    }

    return g
  }

  private syncTuning(state: GameState, content: ContentDB) {
    const themeId = state.floor.gen?.theme?.id
    const intent = getThemeLightIntent(themeId)
    const globalI = Math.max(0, Number(state.render.globalIntensity ?? 1.0))
    const lanternM = intent.lanternIntensityMult ?? 1.0
    const torchM = intent.torchIntensityMult ?? 1.0
    const plAgg = resolvePartyPlayerLightAggregate(state, content, {
      lanternIntensityMult: lanternM,
      torchIntensityMult: torchM,
    })

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

    if (plAgg.summandCount <= 0) {
      this.lantern.intensity = Math.max(0, state.render.bareLightIntensity * lanternM * globalI * flicker)
      this.lantern.distance = state.render.bareLightDistance
    } else {
      const raw = plAgg.intensityBeforeGlobalFlicker * globalI * flicker
      const cap = Math.max(0, Number(state.render.equippedLightIntensityCap ?? 10))
      this.lantern.intensity = Math.max(0, Math.min(raw, cap))
      const effMerged = effectiveMergedPlayerLightDistance(
        plAgg.summandCount,
        plAgg.combinedDistance,
        raw,
        cap,
      )
      let d = Math.max(effMerged, plAgg.maxSourceDistance)
      // Lantern rows often use a longer tuned reach than torch; at the same capped intensity, a larger
      // PointLight.distance thins near-field brightness vs torch-only (session 00b0dc post-fix: d≈9.2 > 7.5).
      if (plAgg.anyLantern && plAgg.maxTorchHeldDistance > 0) {
        d = Math.min(d, plAgg.maxTorchHeldDistance)
      }
      this.lantern.distance = d
    }
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
      this.themeSpriteColor.copy(final).multiplyScalar(globalI)
    }

    const mapSize = state.render.shadowMapSize
    if (mapSize !== this.lastShadowMapSize) {
      this.lastShadowMapSize = mapSize
      this.lantern.shadow.mapSize.set(mapSize, mapSize)
      this.lantern.shadow.needsUpdate = true
    }

    const filterChoices = [THREE.BasicShadowMap, THREE.PCFShadowMap, THREE.PCFSoftShadowMap] as const
    const nextFilter = filterChoices[state.render.shadowFilter] ?? THREE.PCFSoftShadowMap
    if (this.lastShadowFilter !== nextFilter) {
      this.lastShadowFilter = nextFilter
      this.renderer.shadowMap.type = nextFilter
      this.renderer.shadowMap.needsUpdate = true
    }

    const wantPointShadow = state.render.shadowLanternPoint > 0
    this.lantern.castShadow = wantPointShadow
    this.renderer.shadowMap.enabled = wantPointShadow

    // Apply base emissive lift without forcing a rebuild.
    const base = Math.max(0, state.render.baseEmissive) * globalI
    if (this.floorMat) this.floorMat.emissiveIntensity = base * 1.0
    if (this.wallMat) this.wallMat.emissiveIntensity = base * 0.8
    if (this.ceilMat) this.ceilMat.emissiveIntensity = base * 0.6
    if (this.overgrownFloorMat) this.overgrownFloorMat.emissiveIntensity = base * 1.0
    if (this.overgrownWallMat) this.overgrownWallMat.emissiveIntensity = base * 0.8
    if (this.overgrownCeilMat) this.overgrownCeilMat.emissiveIntensity = base * 0.6

    this.syncPoiSpriteBoost(state)
    this.syncLitBillboardEmissive(base)

    const torchKey = `${state.floor.floorGeomRevision}|${state.floor.playerPos.x},${state.floor.playerPos.y}|${state.render.torchPoiLightMax}`
    if (torchKey !== this.lastTorchPickKey) {
      this.lastTorchPickKey = torchKey
      this.cachedTorchPicked = nearestPoisByManhattan(
        state.floor.pois,
        state.floor.playerPos.x,
        state.floor.playerPos.y,
        state.render.torchPoiLightMax,
      )
    }
    const torchPicked = this.cachedTorchPicked
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

    const floorPlParts: string[] = []
    for (const it of state.floor.itemsOnFloor) {
      const inv = state.party.items[it.id]
      if (!inv) continue
      if (!content.item(inv.defId).playerLight) continue
      floorPlParts.push(
        `${it.id}:${it.pos.x},${it.pos.y}:${it.jitter?.x ?? 0},${it.jitter?.z ?? 0}:${inv.defId}:${inv.glowbugs ?? ''}`,
      )
    }
    floorPlParts.sort()
    const floorPlKey = `${state.floor.floorGeomRevision}|${state.floor.playerPos.x},${state.floor.playerPos.y}|${state.render.playerLightFloorItemMax}|${floorPlParts.join('|')}`
    if (floorPlKey !== this.lastFloorPlayerLightKey) {
      this.lastFloorPlayerLightKey = floorPlKey
      this.cachedFloorPlayerLightPicked = nearestFloorPlayerLightItems(
        state,
        content,
        state.render.playerLightFloorItemMax,
      )
    }
    const floorPicked = this.cachedFloorPlayerLightPicked
    const floorDesired = floorPicked.length
    while (this.floorPlayerLights.length < floorDesired) {
      const l = new THREE.PointLight(0xffd7a0, 1, 8, 2)
      l.castShadow = false
      this.floorPlayerLights.push(l)
      this.scene.add(l)
    }
    while (this.floorPlayerLights.length > floorDesired) {
      const l = this.floorPlayerLights.pop()!
      this.scene.remove(l)
      ;(l as unknown as { dispose?: () => void }).dispose?.()
    }
    const floorLightY = FLOOR_ITEM_SPRITE_CENTER_Y + 0.05
    for (let i = 0; i < floorDesired; i++) {
      const pick = floorPicked[i]!
      const base = floorItemPlayerLightBase(pick.tag, state, pick.glowbugMul, globalI, lanternM, torchM)
      const tf = pick.tag === 'torch' ? 0.88 + 0.12 * Math.sin(t * 6.5 + i * 2.1) : 1
      const x = pick.pos.x - state.floor.w / 2 + pick.jitter.x
      const z = pick.pos.y - state.floor.h / 2 + pick.jitter.z
      const light = this.floorPlayerLights[i]!
      light.position.set(x, floorLightY, z)
      light.distance = base.distance
      light.intensity = Math.max(0, base.intensity * tf * flicker)
      light.color.copy(this.lantern.color)
    }

    if (this.elderDistortionMat) {
      applyElderDistortionUniforms(this.elderDistortionMat, {
        timeSec: state.nowMs * 0.001,
        theme: this.themeSpriteColor,
        tuning: state.render.elderDistortion,
        shaderQuality: state.render.elderShaderQuality,
        npcSpriteBoost: Number(state.render.npcSpriteBoost ?? 1),
      })
    }
    this.syncLitBillboardFacingCamera()
    this.syncNpcSpriteScales(state)
    this.syncPoiSpriteScales(state)
    this.syncCampfireEmojiFlicker(state)
    this.syncDoorSprites(state)
    this.syncFloorItemSprites(state)
    this.syncHazardDecalScales()
    this.syncNpcIdleFrames(state)
    this.syncWellSparkleFrame(state)
  }

  private syncPoiSpriteBoost(state: GameState) {
    this.lastPoiSpriteBoost = Math.max(0, Number(state.render.poiSpriteBoost ?? 1.0))
    this.lastNpcSpriteBoost = Math.max(0, Number(state.render.npcSpriteBoost ?? 1.0))
  }

  /**
   * Lit billboard fill: `baseEmissive` × boost on emissive, and **albedo `color` × boost** on Lambert sprites.
   * Emissive alone is barely visible when point lights dominate diffuse; scaling `color` makes F2 boosts read in normal play.
   */
  private syncLitBillboardEmissive(baseEmissiveScaled: number) {
    const poiBoost = Number.isFinite(this.lastPoiSpriteBoost) ? this.lastPoiSpriteBoost : 1.0
    const poiEm = baseEmissiveScaled * poiBoost
    const npcBoost = Number.isFinite(this.lastNpcSpriteBoost) ? this.lastNpcSpriteBoost : 1.0
    const npcEm = baseEmissiveScaled * npcBoost

    for (const kind of Object.keys(this.npcBillboardMats) as NpcKind[]) {
      const mat = this.npcBillboardMats[kind]
      if (!mat) continue
      mat.emissiveIntensity = npcEm
      const tintHex = NPC_SPRITE_TINT_HEX[kind]
      if (tintHex !== undefined) {
        mat.color.setHex(tintHex).multiplyScalar(npcBoost)
      } else {
        mat.color.setRGB(npcBoost, npcBoost, npcBoost)
      }
    }
    for (const mat of Object.values(this.poiBillboardMats)) {
      if (!mat) continue
      mat.emissiveIntensity = poiEm
      mat.color.setRGB(poiBoost, poiBoost, poiBoost)
    }
    for (const mat of Object.values(this.poiOpenedBillboardMats)) {
      if (!mat) continue
      mat.emissiveIntensity = poiEm
      mat.color.setRGB(poiBoost, poiBoost, poiBoost)
    }
    if (this.wellDrainedMat) {
      this.wellDrainedMat.emissiveIntensity = poiEm
      this.wellDrainedMat.color.setRGB(poiBoost, poiBoost, poiBoost)
    }
    // Filled-well VFX: Lambert base already uses `poiBoost`; glow/sparkle are separate `Sprite` materials.
    if (this.wellGlowMat) {
      this.wellGlowMat.color.setRGB(poiBoost, poiBoost, poiBoost)
    }
    if (this.wellSparkleMat) {
      this.wellSparkleMat.color.setRGB(poiBoost, poiBoost, poiBoost)
    }
    for (const mat of [
      this.doorClosedMat,
      this.doorOctopusClosedMat,
      this.doorOpenMat,
      this.doorOctopusOpenStaticMat,
    ]) {
      if (mat) mat.emissiveIntensity = baseEmissiveScaled
    }
    for (const prop of ALL_ROOM_HAZARD_PROPERTIES) {
      const m = this.hazardDecalMats[prop]
      if (m) m.emissiveIntensity = baseEmissiveScaled
    }
    for (const p of this.pickables) {
      const mesh = p as THREE.Mesh
      if (!mesh.isMesh) continue
      if (mesh.material === this.elderDistortionMat) continue
      const mat = mesh.material as THREE.MeshLambertMaterial
      if (!mat) continue
      const ud = mesh.userData as { kind?: unknown; poiEmojiBillboard?: boolean; npcEmojiBillboard?: boolean }
      const k = String(ud.kind ?? '')
      if (k === 'floorItem') mat.emissiveIntensity = baseEmissiveScaled
      else if (ud.poiEmojiBillboard) {
        mat.emissiveIntensity = poiEm
        mat.color.setRGB(poiBoost, poiBoost, poiBoost)
      } else if (ud.npcEmojiBillboard) {
        mat.emissiveIntensity = npcEm
        mat.color.setRGB(npcBoost, npcBoost, npcBoost)
      }
    }
    if (this.doorFxGroup) {
      this.doorFxGroup.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        const m = mesh.material as THREE.MeshLambertMaterial
        if (m) m.emissiveIntensity = baseEmissiveScaled
      })
    }
  }

  private syncLitBillboardFacingCamera() {
    const q = this.camera.quaternion
    for (const n of this.npcBillboards) {
      n.object.quaternion.copy(q)
    }
    for (const p of this.poiBillboards) {
      p.mesh.quaternion.copy(q)
    }
    for (const p of this.pickables) {
      const mesh = p as THREE.Mesh
      if (!mesh.isMesh) continue
      const k = String((mesh.userData as { kind?: unknown }).kind ?? '')
      if (k === 'door' || k === 'floorItem') mesh.quaternion.copy(q)
    }
    for (const { mesh } of this.hazardDecalMeshes) {
      mesh.quaternion.copy(q)
    }
    for (const entry of this.doorFxTracked) {
      entry.mesh.quaternion.copy(q)
    }
    for (const w of this.wellDecorSprites) {
      w.main.quaternion.copy(q)
    }
  }

  private ensureElderDistortionMat(): THREE.ShaderMaterial {
    if (!this.elderDistortionMat) {
      this.elderDistortionMat = createElderDistortionMaterial(this.themeSpriteColor)
    }
    return this.elderDistortionMat
  }

  private syncHazardDecalScales() {
    const baseH = HAZARD_DECAL_HEIGHT
    for (const { mesh, prop } of this.hazardDecalMeshes) {
      const aspect = this.hazardDecalAspects[prop] ?? 1.0
      mesh.scale.set(baseH * aspect, baseH, 1)
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

  private getWellDrainedMat(): THREE.MeshLambertMaterial {
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
    this.wellDrainedMat = createLitBillboardLambertMaterial(tex)
    return this.wellDrainedMat
  }

  private getPoiOpenedBillboardMat(kind: keyof typeof POI_OPENED_SPRITE_SRC): THREE.MeshLambertMaterial {
    const cached = this.poiOpenedBillboardMats[kind]
    if (cached) return cached

    const src = POI_OPENED_SPRITE_SRC[kind]
    if (!src) return this.getPoiBillboardMat(kind)

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

    const mat = createLitBillboardLambertMaterial(tex)
    this.poiOpenedBillboardMats[kind] = mat
    return mat
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
      color: new THREE.Color(0xffffff),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      opacity: 1,
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

  private getPoiBillboardMat(kind: keyof typeof POI_SPRITE_SRC): THREE.MeshLambertMaterial {
    const cached = this.poiBillboardMats[kind]
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

    const mat = createLitBillboardLambertMaterial(tex)
    this.poiBillboardMats[kind] = mat
    return mat
  }

  private syncPoiSpriteScales(state: GameState) {
    if (!this.poiBillboards.length) return

    const floorTopY = 0
    const foot = Number(state.render.poiFootLift ?? 0.02)
    const baseH = 0.55
    /** Exit (`stairs_down`) renders at 2× other POI billboards for readability. */
    const exitMult = 2
    const kuratkoNestScale = Math.max(0.25, Math.min(3, Number(state.render.poiKuratkoNestSpriteScale ?? 1)))
    const campfireScale = Math.max(0.25, Math.min(3, Number(state.render.poiCampfireSpriteScale ?? 1)))
    for (const p of this.poiBillboards) {
      const mult =
        p.kind === 'Exit'
          ? exitMult
          : p.kind === 'KuratkoNest'
            ? kuratkoNestScale
            : p.kind === 'Campfire'
              ? campfireScale
              : 1
      const h = baseH * mult
      const aspect = this.poiSpriteAspects[p.kind] ?? 1.0
      p.mesh.scale.set(h * aspect, h, 1)
      const groundY = this.getPoiGroundYForKind(state, p.kind)
      // Bottom pivot: texture row at `groundY` (0=bottom) meets the floor at `floorTopY + foot`.
      p.mesh.position.y = floorTopY + foot - groundY * h
    }

    const r = state.render
    const gnx = Number(r.poiWellGlowNudgeX ?? 0)
    const gny = Number(r.poiWellGlowNudgeY ?? 0)
    const gnz = Number(r.poiWellGlowNudgeZ ?? 0)
    const snx = Number(r.poiWellSparkleNudgeX ?? 0)
    const sny = Number(r.poiWellSparkleNudgeY ?? 0)
    const snz = Number(r.poiWellSparkleNudgeZ ?? 0)
    for (const d of this.wellDecorSprites) {
      const mx = d.main.position.x
      const my = d.main.position.y
      const mz = d.main.position.z
      d.glow.position.set(mx + gnx, my + gny, mz + gnz)
      d.sparkle.position.set(mx + snx, my + sny, mz + snz)
      d.glow.scale.copy(d.main.scale).multiplyScalar(1.08)
      d.sparkle.scale.copy(d.main.scale).multiplyScalar(0.5)
    }
  }

  /** Slow opacity shimmer on campfire emoji billboards (~1–3 Hz effective, per-instance phase). */
  private syncCampfireEmojiFlicker(state: GameState) {
    const t = state.nowMs * 0.001
    for (const p of this.poiBillboards) {
      if (p.kind !== 'Campfire') continue
      const mat = p.mesh.material as THREE.MeshLambertMaterial
      const phase = campfireFlickerPhaseRad(p.id)
      const a = 0.5 + 0.5 * Math.sin(t * TAU * 1.25 + phase)
      const b = 0.5 + 0.5 * Math.sin(t * TAU * 2.4 + phase * 1.6)
      mat.opacity = 0.84 + 0.12 * a + 0.04 * b
    }
  }

  private textureAspectFromMapMesh(mesh: THREE.Mesh): number {
    const mat = mesh.material as THREE.MeshLambertMaterial | undefined
    const img = mat?.map?.image as { width?: unknown; height?: unknown } | undefined
    const iw = img && typeof img.width === 'number' ? img.width : 0
    const ih = img && typeof img.height === 'number' ? img.height : 0
    if (iw > 0 && ih > 0) return iw / ih
    return 1
  }

  private doorBillboardTuning(state: GameState, visual: 'wooden' | 'octopus') {
    const r = state.render
    if (visual === 'octopus') {
      return {
        h: Number(r.doorOctopusSpriteHeight ?? 1),
        cy: Number(r.doorOctopusSpriteCenterY ?? 0.55),
        nx: Number(r.doorOctopusSpriteNudgeX ?? 0),
        nz: Number(r.doorOctopusSpriteNudgeZ ?? 0),
      }
    }
    return {
      h: Number(r.doorWoodenSpriteHeight ?? 1),
      cy: Number(r.doorWoodenSpriteCenterY ?? 0.55),
      nx: Number(r.doorWoodenSpriteNudgeX ?? 0),
      nz: Number(r.doorWoodenSpriteNudgeZ ?? 0),
    }
  }

  private syncDoorSprites(state: GameState) {
    const activeOctopusDoorFxCells = new Set<string>()
    for (const fx of state.ui.doorOpenFx ?? []) {
      if (fx.untilMs <= state.nowMs) continue
      if (fx.visual !== 'octopus') continue
      activeOctopusDoorFxCells.add(`${fx.pos.x},${fx.pos.y}`)
    }
    const fw = state.floor.w
    const fh = state.floor.h
    const tiles = state.floor.tiles

    for (const p of this.pickables) {
      const ud = (p.userData ?? {}) as { kind?: unknown; doorVisual?: unknown; baseX?: unknown; baseZ?: unknown }
      if (String(ud.kind ?? '') !== 'door') continue
      const visual = ud.doorVisual === 'octopus' ? 'octopus' : 'wooden'
      const { h, cy, nx, nz } = this.doorBillboardTuning(state, visual)
      const doorMesh = p as THREE.Mesh
      const baseX = typeof ud.baseX === 'number' ? ud.baseX : doorMesh.position.x
      const baseZ = typeof ud.baseZ === 'number' ? ud.baseZ : doorMesh.position.z
      const aspect = this.textureAspectFromMapMesh(doorMesh)
      doorMesh.scale.set(h * aspect, h, 1)
      doorMesh.position.set(baseX + nx, cy, baseZ + nz)

      const cellX = Math.round(baseX + fw / 2)
      const cellY = Math.round(baseZ + fh / 2)
      const idx = cellX + cellY * fw
      const tile = tiles[idx]
      const hideStaticWhileFx =
        tile === 'doorOpenOctopus' && activeOctopusDoorFxCells.has(`${cellX},${cellY}`)
      doorMesh.visible = !hideStaticWhileFx
    }

    for (const entry of this.doorFxTracked) {
      const { h, cy, nx, nz } = this.doorBillboardTuning(state, entry.visual)
      const wx = entry.cellX - fw / 2
      const wz = entry.cellY - fh / 2
      const aspect = this.textureAspectFromMapMesh(entry.mesh)
      entry.mesh.scale.set(h * aspect, h, 1)
      entry.mesh.position.set(wx + nx, cy, wz + nz)
    }
  }

  private syncFloorItemSprites(state: GameState) {
    const h = Number(state.render.floorItemSpriteHeight)
    if (!Number.isFinite(h) || h <= 0) return
    const nx = Number(state.render.floorItemSpriteNudgeX)
    const ny = Number(state.render.floorItemSpriteNudgeY)
    const nz = Number(state.render.floorItemSpriteNudgeZ)
    const nudgeX = Number.isFinite(nx) ? nx : 0
    const nudgeY = Number.isFinite(ny) ? ny : 0
    const nudgeZ = Number.isFinite(nz) ? nz : 0
    for (const p of this.pickables) {
      const ud = (p.userData ?? {}) as { kind?: unknown; baseX?: unknown; baseZ?: unknown }
      if (String(ud.kind ?? '') !== 'floorItem') continue
      const itemMesh = p as THREE.Mesh
      const aspect = this.textureAspectFromMapMesh(itemMesh)
      itemMesh.scale.set(h * aspect, h, 1)
      const baseX = typeof ud.baseX === 'number' ? ud.baseX : itemMesh.position.x
      const baseZ = typeof ud.baseZ === 'number' ? ud.baseZ : itemMesh.position.z
      itemMesh.position.set(baseX + nudgeX, FLOOR_ITEM_SPRITE_CENTER_Y + nudgeY, baseZ + nudgeZ)
    }
  }

  private getHazardDecalMat(prop: RoomHazardProperty): THREE.MeshLambertMaterial {
    const cached = this.hazardDecalMats[prop]
    if (cached) return cached

    const src = ROOM_HAZARD_SPRITE_SRC[prop]
    const tex = this.textureLoader.load(src, () => {
      const img = tex.image as unknown as { width?: unknown; height?: unknown } | undefined
      const iw = img && typeof img.width === 'number' ? img.width : 0
      const ih = img && typeof img.height === 'number' ? img.height : 0
      if (iw > 0 && ih > 0) this.hazardDecalAspects[prop] = iw / ih
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false

    const mat = createLitBillboardLambertMaterial(tex)
    this.hazardDecalMats[prop] = mat
    return mat
  }

  private getDoorClosedMat(): THREE.MeshLambertMaterial {
    if (this.doorClosedMat) return this.doorClosedMat
    const tex = this.textureLoader.load(DOOR_CLOSED_SRC)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.doorClosedMat = createLitBillboardLambertMaterial(tex)
    return this.doorClosedMat
  }

  private getDoorOctopusClosedMat(): THREE.MeshLambertMaterial {
    if (this.doorOctopusClosedMat) return this.doorOctopusClosedMat
    const tex = this.textureLoader.load(DOOR_OCTOPUS_CLOSED_SRC)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.doorOctopusClosedMat = createLitBillboardLambertMaterial(tex)
    return this.doorOctopusClosedMat
  }

  private getDoorOpenMat(): THREE.MeshLambertMaterial {
    if (this.doorOpenMat) return this.doorOpenMat
    const tex = this.textureLoader.load(DOOR_OPEN_SRC)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.doorOpenMat = createLitBillboardLambertMaterial(tex)
    return this.doorOpenMat
  }

  private getDoorOctopusOpenStaticMat(): THREE.MeshLambertMaterial {
    if (this.doorOctopusOpenStaticMat) return this.doorOctopusOpenStaticMat
    const octo = this.ensureDoorOctopusOpenTextures()
    const n = DOOR_OCTOPUS_OPEN_FRAMES.length
    const tex = octo[n - 1]!
    this.doorOctopusOpenStaticMat = createLitBillboardLambertMaterial(tex)
    return this.doorOctopusOpenStaticMat
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

  /** Normalized ground contact from bottom of texture (same 0–1 convention as `npcBillboard.*.groundY`). */
  private getPoiGroundYForKind(state: GameState, kind: PoiKind) {
    const r = state.render
    switch (kind) {
      case 'Well':
        return r.poiGroundY_Well
      case 'Chest':
        return r.poiGroundY_Chest
      case 'Barrel':
        return r.poiGroundY_Barrel
      case 'Crate':
        return r.poiGroundY_Crate
      case 'Bed':
        return r.poiGroundY_Bed
      case 'Shrine':
        return r.poiGroundY_Shrine
      case 'CrackedWall':
        return r.poiGroundY_CrackedWall
      case 'Exit':
        return r.poiGroundY_Exit
      case 'Campfire':
        return r.poiGroundY_Campfire
      case 'KuratkoNest':
        return r.poiGroundY_KuratkoNest
    }
  }

  private getOrLoadNpcTexture(url: string, onImageLoad?: () => void): THREE.Texture {
    const hit = this.npcLoaderTexturesByUrl.get(url)
    if (hit) {
      const img = hit.image as HTMLImageElement | undefined
      if (img && img.complete && img.naturalWidth > 0) {
        onImageLoad?.()
      } else if (img && !img.complete) {
        const onLoad = () => {
          img.removeEventListener('load', onLoad)
          onImageLoad?.()
        }
        img.addEventListener('load', onLoad)
      }
      return hit
    }
    const tex = this.textureLoader.load(url, () => {
      onImageLoad?.()
    })
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    this.npcLoaderTexturesByUrl.set(url, tex)
    return tex
  }

  private getNpcBillboardMat(kind: NpcKind): THREE.MeshLambertMaterial {
    const cached = this.npcBillboardMats[kind]
    if (cached) return cached

    const src = NPC_SPRITE_SRC[kind]
    const tex = this.getOrLoadNpcTexture(src, () => {
      const img = tex.image as unknown as { width?: unknown; height?: unknown } | undefined
      const w = img && typeof img.width === 'number' ? img.width : 0
      const h = img && typeof img.height === 'number' ? img.height : 0
      if (w > 0 && h > 0) this.npcSpriteAspects[kind] = w / h
    })

    this.npcSpriteBaseTex[kind] = tex
    const mat = createLitBillboardLambertMaterial(tex)
    this.npcBillboardMats[kind] = mat
    return mat
  }

  private ensureNpcIdleTexture(kind: NpcKind, src: string): THREE.Texture | null {
    const existing = this.npcIdleTextures[kind]
    if (existing) return existing
    const tex = this.getOrLoadNpcTexture(src, () => {
      tex.needsUpdate = true
    })
    this.npcIdleTextures[kind] = tex
    return tex
  }

  private syncNpcIdleFrames(state: GameState) {
    for (const kind of Object.keys(NPC_SPRITE_IDLE_SRC) as NpcKind[]) {
      const idleSrc = NPC_SPRITE_IDLE_SRC[kind]
      if (!idleSrc) continue
      const mat = this.npcBillboardMats[kind]
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
    if (!this.npcBillboards.length) return

    for (const n of this.npcBillboards) {
      const size = this.getNpcSizeForKind(state, n.kind, n.id)
      const aspect =
        n.mode === 'elder'
          ? state.render.elderDistortion.billboardAspect
          : n.mode === 'emoji'
            ? 1.0
            : (this.npcSpriteAspects[n.kind] ?? 1.0)
      const width = size * aspect
      n.object.scale.set(width, size, 1)

      // Align the bottom of the sprite with the floor surface.
      // Floor top is y=0 (floor boxes are centered at y=-0.05 with height 0.1).
      const floorTopY = 0
      const lift = Number(state.render.npcFootLift ?? 0)
      const groundY = this.getNpcGroundYForKind(state, n.kind)
      n.object.position.y = floorTopY + lift + size * (0.5 - groundY)
    }
  }

  private getNpcGroundYForKind(state: GameState, kind: NpcKind) {
    return state.render.npcBillboard[kind].groundY
  }

  private getNpcSizeForKind(state: GameState, kind: NpcKind, npcId: string) {
    const base = this.getNpcBaseSizeForKind(state, kind)
    const randPct = this.getNpcSizeRandForKind(state, kind)
    const signed = this.signedUnitFromStr(`npcSize:${state.floor.seed}:${kind}:${npcId}`)
    const factor = 1 + signed * randPct
    const row = state.floor.npcs.find((n) => n.id === npcId)
    const bossMul = row?.variant === 'boss' ? bossVisualScale(row) : 1
    return Math.max(0.05, base * factor * bossMul)
  }

  private getNpcBaseSizeForKind(state: GameState, kind: NpcKind) {
    return state.render.npcBillboard[kind].size
  }

  private getNpcSizeRandForKind(state: GameState, kind: NpcKind) {
    return state.render.npcBillboard[kind].sizeRand
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
          if (t !== 'floor' && !isAnyDoorTile(t) && !isPassableOpenDoorTile(t)) continue
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
          if (t !== 'floor' && !isAnyDoorTile(t) && !isPassableOpenDoorTile(t)) continue
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

function disposeGeoGroupResources(group: THREE.Object3D) {
  const ud = group.userData as {
    disposableBoxGeoms?: THREE.BufferGeometry[]
    disposableMeshMats?: THREE.Material[]
  }
  if (ud.disposableBoxGeoms) {
    for (const geom of ud.disposableBoxGeoms) geom.dispose()
  }
  if (ud.disposableMeshMats) {
    for (const m of ud.disposableMeshMats) m.dispose()
  }
  group.traverse((obj) => {
    const u = obj.userData as { disposableItemIcon?: boolean }
    if (!u.disposableItemIcon) return
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mat = mesh.material as THREE.MeshLambertMaterial
    const map = mat.map
    // Emoji icons use CanvasTexture; loader icons share textures cached on WorldRenderer — never dispose those maps here.
    if (map instanceof THREE.CanvasTexture) map.dispose()
    mat.dispose()
  })
  group.traverse((obj) => {
    const u = obj.userData as { elderProcedural?: boolean }
    if (!u.elderProcedural) return
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
  })
}

function resolveFloorItemIcon(
  state: GameState,
  content: ContentDB,
  floorItemId: string,
): { kind: 'emoji'; glyph: string; tintFilter?: string; displayScale?: number; rotateDeg?: number; flipHorizontal?: boolean; flipVertical?: boolean } | { kind: 'sprite'; path: string } {
  const item = state.party.items[floorItemId as ItemId]
  if (!item) return { kind: 'emoji', glyph: '□' }
  try {
    const def = content.item(item.defId)
    if (def.icon.kind === 'emoji')
      return {
        kind: 'emoji',
        glyph: def.icon.value,
        tintFilter: def.icon.tintFilter,
        displayScale: def.icon.displayScale,
        rotateDeg: def.icon.rotateDeg,
        flipHorizontal: def.icon.flipHorizontal,
        flipVertical: def.icon.flipVertical,
      }
    return { kind: 'sprite', path: def.icon.path }
  } catch {
    return { kind: 'emoji', glyph: '□' }
  }
}

function makeItemIconBillboardMaterial(
  glyph: string,
  opts?: {
    tintFilter?: string
    displayScale?: number
    rotateDeg?: number
    flipHorizontal?: boolean
    flipVertical?: boolean
  },
) {
  const canvas = renderItemEmojiIconToCanvas({
    glyph,
    tintFilter: opts?.tintFilter,
    displayScale: opts?.displayScale,
    rotateDeg: opts?.rotateDeg,
    flipHorizontal: opts?.flipHorizontal,
    flipVertical: opts?.flipVertical,
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false

  return createLitBillboardLambertMaterial(tex)
}

