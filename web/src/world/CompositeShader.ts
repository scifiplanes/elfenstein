export const CompositeShader = {
  uniforms: {
    tScene: { value: null },
    tUi: { value: null },
    resolution: { value: { x: 1, y: 1 } },
    gameRectPx: { value: { x: 0, y: 0, z: 1, w: 1 } }, // left, top, width, height in pixels
    debugSceneMode: { value: 0.0 }, // 1 = show scene fullscreen; 2 = show center sample fullscreen
    debugSceneFlipY: { value: 1.0 }, // 1 = flip scene uv y
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tUi;
uniform vec2 resolution;
uniform vec4 gameRectPx;
uniform float debugSceneMode;
uniform float debugSceneFlipY;
varying vec2 vUv;

bool insideRect(vec2 p, vec4 r) {
  return p.x >= r.x && p.y >= r.y && p.x < (r.x + r.z) && p.y < (r.y + r.w);
}

void main() {
  // Use gl_FragCoord so DPR/pixelRatio is handled correctly.
  // DOM rects (getBoundingClientRect) are top-origin; gl_FragCoord is bottom-origin.
  vec2 px = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  vec4 ui = texture2D(tUi, vUv);

  if (debugSceneMode > 1.5) {
    vec4 c = texture2D(tScene, vec2(0.5, 0.5));
    gl_FragColor = vec4(c.rgb, 1.0);
    return;
  }

  if (debugSceneMode > 0.5) {
    gl_FragColor = texture2D(tScene, vUv);
    return;
  }

  if (!insideRect(px, gameRectPx)) {
    gl_FragColor = ui;
    return;
  }

  vec2 localPx = px - gameRectPx.xy;
  vec2 sceneUv = localPx / max(vec2(1.0), gameRectPx.zw);
  if (debugSceneFlipY > 0.5) {
    // localPx is top-origin; WebGL textures are bottom-origin.
    sceneUv.y = 1.0 - sceneUv.y;
  }
  sceneUv = clamp(sceneUv, 0.0, 1.0);
  vec4 scene = texture2D(tScene, sceneUv);
  // If the scene texture is missing/black, show a visible diagnostic tint.
  if (scene.a == 0.0 && scene.rgb == vec3(0.0)) {
    float s = step(0.5, fract((localPx.x + localPx.y) * 0.03));
    scene = vec4(mix(vec3(0.6, 0.0, 0.0), vec3(0.9, 0.0, 0.3), s), 1.0);
  }

  gl_FragColor = scene * (1.0 - ui.a) + ui;
}
`,
}

