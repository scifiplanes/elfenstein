import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ELDER_DISTORTION } from '../game/elderDistortionTuning'
import {
  applyElderDistortionUniforms,
  createElderDistortionMaterial,
  elderDistortionTuningCacheKey,
} from './elderDistortionBillboard'

describe('elderDistortionTuningCacheKey', () => {
  it('is stable for identical tuning values', () => {
    const a = { ...DEFAULT_ELDER_DISTORTION }
    const b = { ...DEFAULT_ELDER_DISTORTION }
    expect(elderDistortionTuningCacheKey(a)).toBe(elderDistortionTuningCacheKey(b))
  })

  it('changes when a field changes', () => {
    const base = elderDistortionTuningCacheKey(DEFAULT_ELDER_DISTORTION)
    const next = elderDistortionTuningCacheKey({ ...DEFAULT_ELDER_DISTORTION, ellipseRx: 0.77 })
    expect(next).not.toBe(base)
  })
})

describe('applyElderDistortionUniforms', () => {
  it('always updates time, theme, and shader quality', () => {
    const mat = createElderDistortionMaterial(new THREE.Color(1, 0, 0))
    const theme = new THREE.Color(0.25, 0.5, 0.75)
    applyElderDistortionUniforms(mat, {
      timeSec: 3.5,
      theme,
      tuning: DEFAULT_ELDER_DISTORTION,
      shaderQuality: 0,
      npcSpriteBoost: 1,
    })
    expect(mat.uniforms.uTime.value).toBe(3.5)
    expect(mat.uniforms.uQuality.value).toBe(0)
    const tc = mat.uniforms.uThemeColor.value as THREE.Vector3
    expect(tc.x).toBeCloseTo(0.25)
    expect(tc.y).toBeCloseTo(0.5)
    expect(tc.z).toBeCloseTo(0.75)

    applyElderDistortionUniforms(mat, {
      timeSec: 4,
      theme,
      tuning: DEFAULT_ELDER_DISTORTION,
      shaderQuality: 2,
      npcSpriteBoost: 1,
    })
    expect(mat.uniforms.uTime.value).toBe(4)
    expect(mat.uniforms.uQuality.value).toBe(2)
  })

  it('updates tuning-driven uniforms when tuning content changes', () => {
    const mat = createElderDistortionMaterial(new THREE.Color(1, 1, 1))
    const theme = new THREE.Color(1, 1, 1)
    applyElderDistortionUniforms(mat, {
      timeSec: 0,
      theme,
      tuning: DEFAULT_ELDER_DISTORTION,
      shaderQuality: 2,
      npcSpriteBoost: 1,
    })
    const defaultRx = DEFAULT_ELDER_DISTORTION.ellipseRx
    expect(mat.uniforms.uEllipseRx.value).toBe(defaultRx)

    applyElderDistortionUniforms(mat, {
      timeSec: 0,
      theme,
      tuning: { ...DEFAULT_ELDER_DISTORTION, ellipseRx: 0.55 },
      shaderQuality: 2,
      npcSpriteBoost: 1,
    })
    expect(mat.uniforms.uEllipseRx.value).toBe(0.55)

    applyElderDistortionUniforms(mat, {
      timeSec: 0,
      theme,
      tuning: DEFAULT_ELDER_DISTORTION,
      shaderQuality: 2,
      npcSpriteBoost: 1,
    })
    expect(mat.uniforms.uEllipseRx.value).toBe(defaultRx)
  })

  it('updates npcSpriteBoost every call (not tuning-cached)', () => {
    const mat = createElderDistortionMaterial(new THREE.Color(1, 1, 1))
    const theme = new THREE.Color(1, 1, 1)
    applyElderDistortionUniforms(mat, {
      timeSec: 0,
      theme,
      tuning: DEFAULT_ELDER_DISTORTION,
      shaderQuality: 2,
      npcSpriteBoost: 1.25,
    })
    expect(mat.uniforms.uNpcSpriteBoost.value).toBe(1.25)
    applyElderDistortionUniforms(mat, {
      timeSec: 0,
      theme,
      tuning: DEFAULT_ELDER_DISTORTION,
      shaderQuality: 2,
      npcSpriteBoost: 2,
    })
    expect(mat.uniforms.uNpcSpriteBoost.value).toBe(2)
  })
})
