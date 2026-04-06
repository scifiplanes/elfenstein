import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { shakeEnvelopeFactor } from '../game/shakeEnvelope'
import type { GameState } from '../game/types'
import { DitherShader } from './DitherShader'
import { makeCeilTexture, makeFloorTexture, makeWallTexture } from './procTextures'

export class WorldRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly composer: EffectComposer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly lantern: THREE.PointLight
  private readonly lanternBeam: THREE.SpotLight
  private readonly lanternBeamTarget: THREE.Object3D
  private readonly torchLights: THREE.PointLight[] = []
  private readonly ditherPass: ShaderPass

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
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

    const renderPass = new RenderPass(this.scene, this.camera)
    this.ditherPass = new ShaderPass(DitherShader)
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(renderPass)
    this.composer.addPass(this.ditherPass)

    this.syncSize()
  }

  dispose() {
    this.geoGroup?.traverse((obj) => {
      const mesh = obj as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>
      if (mesh.geometry) mesh.geometry.dispose?.()
      const mat = mesh.material as any
      if (mat?.dispose) mat.dispose()
    })
    this.composer.dispose()
    this.renderer.dispose()
  }

  renderFrame(state: GameState) {
    this.syncSize()
    this.syncScene(state)
    this.syncTuning(state)
    this.composer.render()
  }

  pickTarget(clientX: number, clientY: number): null | { kind: 'poi'; id: string } | { kind: 'npc'; id: string } | { kind: 'floorItem'; id: string } | { kind: 'door'; id: string } {
    if (!this.pickables.length) return null
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1)
    this.ndc.set(x, y)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, true)
    const hit = hits[0]
    if (!hit) return null
    const ud: any = (hit.object as any).userData
    if (!ud?.kind || !ud?.id) return null
    if (ud.kind === 'poi') return { kind: 'poi', id: String(ud.id) }
    if (ud.kind === 'npc') return { kind: 'npc', id: String(ud.id) }
    if (ud.kind === 'floorItem') return { kind: 'floorItem', id: String(ud.id) }
    if (ud.kind === 'door') return { kind: 'door', id: String(ud.id) }
    return null
  }

  pickObject(clientX: number, clientY: number): null | { kind: 'poi' | 'npc' | 'floorItem' | 'door'; id: string; worldPos: THREE.Vector3 } {
    if (!this.pickables.length) return null
    const rect = this.canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1)
    this.ndc.set(x, y)
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickables, true)
    const hit = hits[0]
    if (!hit) return null
    const ud: any = (hit.object as any).userData
    if (!ud?.kind || !ud?.id) return null
    const kind = String(ud.kind) as any
    if (kind !== 'poi' && kind !== 'npc' && kind !== 'floorItem' && kind !== 'door') return null
    return { kind, id: String(ud.id), worldPos: hit.point.clone() }
  }

  projectWorldToClient(pos: THREE.Vector3): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect()
    const v = pos.clone().project(this.camera)
    const x = (v.x * 0.5 + 0.5) * rect.width + rect.left
    const y = (-v.y * 0.5 + 0.5) * rect.height + rect.top
    return { x, y }
  }

  private syncSize() {
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    if (w === this.lastSize.w && h === this.lastSize.h) return

    const capped = Math.min(window.devicePixelRatio || 1, 1.5)
    this.renderer.setPixelRatio(capped)
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.lastSize = { w, h }
  }

  private syncScene(state: GameState) {
    const key = `${state.floor.w}x${state.floor.h}:${state.floor.tiles.join('')}:${state.floor.pois.map((p)=>p.id+','+p.pos.x+','+p.pos.y+','+(p.opened?'1':'0')).join('|')}:${state.floor.npcs.map((n)=>n.id+','+n.pos.x+','+n.pos.y+','+n.hp).join('|')}:${state.floor.itemsOnFloor.map((i)=>i.id+','+i.pos.x+','+i.pos.y).join('|')}`
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
          ;(d as any).userData = { kind: 'door', id: `${x},${y}` }
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

    const torchGeo = new THREE.SphereGeometry(0.08, 10, 10)
    const torchMat = new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xff7b2a, emissiveIntensity: 1.2, roughness: 0.4 })
    state.floor.pois.forEach((p) => {
      const x = p.pos.x - w / 2
      const z = p.pos.y - h / 2
      const m = new THREE.Mesh(torchGeo, torchMat)
      m.position.set(x, 0.65, z)
      m.castShadow = true
      m.receiveShadow = true
      ;(m as any).userData = { kind: 'poi', id: p.id }
      g.add(m)
      this.pickables.push(m)
    })

    // NPC markers (placeholder sprites to be swapped later).
    const npcGeo = new THREE.SphereGeometry(0.22, 14, 14)
    const npcMat = new THREE.MeshStandardMaterial({ color: 0xd24cff, roughness: 0.4, metalness: 0.0 })
    state.floor.npcs.forEach((n) => {
      const x = n.pos.x - w / 2
      const z = n.pos.y - h / 2
      const m = new THREE.Mesh(npcGeo, npcMat)
      m.position.set(x, 0.25, z)
      m.castShadow = true
      m.receiveShadow = true
      ;(m as any).userData = { kind: 'npc', id: n.id }
      g.add(m)
      this.pickables.push(m)
    })

    // Dropped floor items (placeholder).
    const itemGeo = new THREE.BoxGeometry(0.25, 0.12, 0.25)
    const itemMat = new THREE.MeshStandardMaterial({ color: 0xb6ff8b, roughness: 0.6, metalness: 0.0 })
    state.floor.itemsOnFloor.forEach((it) => {
      const x = it.pos.x - w / 2
      const z = it.pos.y - h / 2
      const m = new THREE.Mesh(itemGeo, itemMat)
      m.position.set(x, 0.02, z)
      m.castShadow = true
      m.receiveShadow = true
      ;(m as any).userData = { kind: 'floorItem', id: it.id }
      g.add(m)
      this.pickables.push(m)
    })

    return g
  }

  private syncTuning(state: GameState) {
    this.scene.fog = new THREE.FogExp2(0x050508, state.render.fogDensity)

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
      ;(l as any).dispose?.()
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

    const u = this.ditherPass.uniforms as any
    u.strength.value = state.render.ditherStrength
    u.colourPreserve.value = state.render.ditherColourPreserve
    u.pixelSize.value = state.render.ditherPixelSize
    u.levels.value = state.render.ditherLevels
    u.matrixSize.value = state.render.ditherMatrixSize
    u.palette.value = state.render.ditherPalette
  }
}

