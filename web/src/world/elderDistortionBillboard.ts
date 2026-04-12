import * as THREE from 'three'
import type { ElderDistortionTuning } from '../game/types'
import { DEFAULT_ELDER_DISTORTION } from '../game/elderDistortionTuning'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uThemeColor;
uniform float uQuality;
uniform float uTimeScale;
uniform float uEllipseRx;
uniform float uEllipseRy;
uniform float uBodyEdgeStart;
uniform float uBodyEdgeEnd;
uniform float uNoiseUvScale;
uniform float uNoiseTimeSpeed;
uniform float uWarpSinAmp;
uniform float uWarpCosAmp;
uniform float uWarpNoiseAmp;
uniform float uWarpPhaseX;
uniform float uWarpFreqY;
uniform float uWarpPhaseY;
uniform float uWarpFreqX;
uniform float uSweepPhase;
uniform float uSweepFreqY;
uniform float uSweepFreqX;
uniform float uPulsePhase;
uniform float uPulseRadialFreq;
uniform float uIridPhase;
uniform float uIridFreqX;
uniform float uBaseTintMin;
uniform float uBaseTintBodyMul;
uniform float uShimmerLow;
uniform float uShimmerSweepMul;
uniform float uShimmerPulseBase;
uniform float uShimmerPulseAmp;
uniform float uAlphaEdgeStart;
uniform float uAlphaEdgeEnd;
uniform float uAlphaBase;
uniform float uAlphaBodyMul;
uniform float uAlphaSweepMul;
uniform float uAlphaMax;
uniform float uNpcSpriteBoost;
varying vec2 vUv;

float hash12(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  float t = uTime * uTimeScale;
  vec2 uv = vUv;
  vec2 p = uv - 0.5;
  float ell = length(vec2(p.x / uEllipseRx, p.y / uEllipseRy));

  // Outside the soft alpha rim the fragment is fully transparent; skip warp/shimmer.
  if (ell > uAlphaEdgeEnd) {
    discard;
  }

  float edgeW = smoothstep(uBodyEdgeStart, uBodyEdgeEnd, ell);
  float body = 1.0 - edgeW;

  bool isSimple = uQuality < 0.5;
  bool isFull = uQuality > 1.5;
  float mFreq = isFull ? 1.0 : (isSimple ? 0.4 : 0.62);
  float mNoise = isFull ? 1.0 : (isSimple ? 0.15 : 0.5);

  vec2 cell = floor(uv * uNoiseUvScale * mNoise + t * uNoiseTimeSpeed);
  vec2 n1 = isSimple ? vec2(0.5) : vec2(hash12(cell), hash12(cell + 19.0));
  vec2 warp = vec2(
    sin(t * uWarpPhaseX + uv.y * uWarpFreqY * mFreq + n1.x * 6.28) * uWarpSinAmp,
    cos(t * uWarpPhaseY + uv.x * uWarpFreqX * mFreq + n1.y * 6.28) * uWarpCosAmp
  );
  if (!isSimple) {
    warp += (n1 - 0.5) * uWarpNoiseAmp * body;
  }
  vec2 wuv = uv + warp * body;

  float sweep = sin(t * uSweepPhase + wuv.y * uSweepFreqY * mFreq + wuv.x * uSweepFreqX * mFreq) * 0.5 + 0.5;
  float pulse = isSimple ? 0.5 : sin(t * uPulsePhase + ell * uPulseRadialFreq * mFreq) * 0.5 + 0.5;

  vec3 irid;
  if (isSimple) {
    irid = vec3(0.62);
  } else if (isFull) {
    irid = vec3(
      0.55 + 0.45 * sin(t * uIridPhase + wuv.x * uIridFreqX),
      0.55 + 0.45 * sin(t * uIridPhase + wuv.x * uIridFreqX + 2.2),
      0.55 + 0.45 * sin(t * uIridPhase + wuv.x * uIridFreqX + 4.4)
    );
  } else {
    float ir = sin(t * uIridPhase + wuv.x * uIridFreqX * mFreq);
    irid = vec3(0.55 + 0.45 * ir, 0.55 + 0.4 * ir, 0.55 + 0.35 * ir);
  }

  vec3 baseTint = uThemeColor * (uBaseTintMin + uBaseTintBodyMul * body);
  float shimmerMul = isSimple ? 0.55 : (isFull ? 1.0 : 0.82);
  vec3 shimmer = uThemeColor * irid *
    (uShimmerLow + uShimmerSweepMul * sweep) *
    (uShimmerPulseBase + uShimmerPulseAmp * pulse) * shimmerMul;
  vec3 col = (baseTint + shimmer) * uNpcSpriteBoost;

  float alpha = (1.0 - smoothstep(uAlphaEdgeStart, uAlphaEdgeEnd, ell)) *
    (uAlphaBase + uAlphaBodyMul * body + uAlphaSweepMul * sweep);
  alpha = clamp(alpha, 0.0, uAlphaMax);

  gl_FragColor = vec4(col, alpha);
}
`

const lastTuningKeyByMaterial = new WeakMap<THREE.ShaderMaterial, string>()

/** Stable JSON key for caching Elder tuning uniforms (all numeric fields). */
export function elderDistortionTuningCacheKey(tuning: ElderDistortionTuning): string {
  return JSON.stringify(tuning)
}

function setUniformsFromTuning(u: THREE.ShaderMaterial['uniforms'], d: ElderDistortionTuning) {
  u.uTimeScale.value = d.timeScale
  u.uEllipseRx.value = d.ellipseRx
  u.uEllipseRy.value = d.ellipseRy
  u.uBodyEdgeStart.value = d.bodyEdgeStart
  u.uBodyEdgeEnd.value = d.bodyEdgeEnd
  u.uNoiseUvScale.value = d.noiseUvScale
  u.uNoiseTimeSpeed.value = d.noiseTimeSpeed
  u.uWarpSinAmp.value = d.warpSinAmp
  u.uWarpCosAmp.value = d.warpCosAmp
  u.uWarpNoiseAmp.value = d.warpNoiseAmp
  u.uWarpPhaseX.value = d.warpPhaseX
  u.uWarpFreqY.value = d.warpFreqY
  u.uWarpPhaseY.value = d.warpPhaseY
  u.uWarpFreqX.value = d.warpFreqX
  u.uSweepPhase.value = d.sweepPhase
  u.uSweepFreqY.value = d.sweepFreqY
  u.uSweepFreqX.value = d.sweepFreqX
  u.uPulsePhase.value = d.pulsePhase
  u.uPulseRadialFreq.value = d.pulseRadialFreq
  u.uIridPhase.value = d.iridPhase
  u.uIridFreqX.value = d.iridFreqX
  u.uBaseTintMin.value = d.baseTintMin
  u.uBaseTintBodyMul.value = d.baseTintBodyMul
  u.uShimmerLow.value = d.shimmerLow
  u.uShimmerSweepMul.value = d.shimmerSweepMul
  u.uShimmerPulseBase.value = d.shimmerPulseBase
  u.uShimmerPulseAmp.value = d.shimmerPulseAmp
  u.uAlphaEdgeStart.value = d.alphaEdgeStart
  u.uAlphaEdgeEnd.value = d.alphaEdgeEnd
  u.uAlphaBase.value = d.alphaBase
  u.uAlphaBodyMul.value = d.alphaBodyMul
  u.uAlphaSweepMul.value = d.alphaSweepMul
  u.uAlphaMax.value = d.alphaMax
}

export function createElderDistortionMaterial(theme: THREE.Color): THREE.ShaderMaterial {
  const d = DEFAULT_ELDER_DISTORTION
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uThemeColor: { value: new THREE.Vector3(theme.r, theme.g, theme.b) },
      uQuality: { value: 2 },
      uTimeScale: { value: d.timeScale },
      uEllipseRx: { value: d.ellipseRx },
      uEllipseRy: { value: d.ellipseRy },
      uBodyEdgeStart: { value: d.bodyEdgeStart },
      uBodyEdgeEnd: { value: d.bodyEdgeEnd },
      uNoiseUvScale: { value: d.noiseUvScale },
      uNoiseTimeSpeed: { value: d.noiseTimeSpeed },
      uWarpSinAmp: { value: d.warpSinAmp },
      uWarpCosAmp: { value: d.warpCosAmp },
      uWarpNoiseAmp: { value: d.warpNoiseAmp },
      uWarpPhaseX: { value: d.warpPhaseX },
      uWarpFreqY: { value: d.warpFreqY },
      uWarpPhaseY: { value: d.warpPhaseY },
      uWarpFreqX: { value: d.warpFreqX },
      uSweepPhase: { value: d.sweepPhase },
      uSweepFreqY: { value: d.sweepFreqY },
      uSweepFreqX: { value: d.sweepFreqX },
      uPulsePhase: { value: d.pulsePhase },
      uPulseRadialFreq: { value: d.pulseRadialFreq },
      uIridPhase: { value: d.iridPhase },
      uIridFreqX: { value: d.iridFreqX },
      uBaseTintMin: { value: d.baseTintMin },
      uBaseTintBodyMul: { value: d.baseTintBodyMul },
      uShimmerLow: { value: d.shimmerLow },
      uShimmerSweepMul: { value: d.shimmerSweepMul },
      uShimmerPulseBase: { value: d.shimmerPulseBase },
      uShimmerPulseAmp: { value: d.shimmerPulseAmp },
      uAlphaEdgeStart: { value: d.alphaEdgeStart },
      uAlphaEdgeEnd: { value: d.alphaEdgeEnd },
      uAlphaBase: { value: d.alphaBase },
      uAlphaBodyMul: { value: d.alphaBodyMul },
      uAlphaSweepMul: { value: d.alphaSweepMul },
      uAlphaMax: { value: d.alphaMax },
      uNpcSpriteBoost: { value: 1 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  })
  return mat
}

export function applyElderDistortionUniforms(
  mat: THREE.ShaderMaterial,
  args: {
    timeSec: number
    theme: THREE.Color
    tuning: ElderDistortionTuning
    shaderQuality: number
    npcSpriteBoost: number
  },
): void {
  const u = mat.uniforms
  u.uTime.value = args.timeSec
  const tc = args.theme
  ;(u.uThemeColor.value as THREE.Vector3).set(tc.r, tc.g, tc.b)
  u.uQuality.value = args.shaderQuality
  u.uNpcSpriteBoost.value = args.npcSpriteBoost

  const tuningKey = elderDistortionTuningCacheKey(args.tuning)
  if (lastTuningKeyByMaterial.get(mat) !== tuningKey) {
    setUniformsFromTuning(u, args.tuning)
    lastTuningKeyByMaterial.set(mat, tuningKey)
  }
}
