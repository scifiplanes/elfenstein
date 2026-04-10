export const CompositeShader = {
  uniforms: {
    tScene: { value: null },
    tUi: { value: null },
    // Portrait reaction overlays (mouth + idle) rendered at compositor time so they are not capture-limited.
    portraitRectPx0: { value: { x: 0, y: 0, z: 0, w: 0 } },
    portraitRectPx1: { value: { x: 0, y: 0, z: 0, w: 0 } },
    portraitRectPx2: { value: { x: 0, y: 0, z: 0, w: 0 } },
    portraitRectPx3: { value: { x: 0, y: 0, z: 0, w: 0 } },
    mouthOn: { value: { x: 0, y: 0, z: 0, w: 0 } },
    idleOn: { value: { x: 0, y: 0, z: 0, w: 0 } },
    eyesInspectOn: { value: { x: 0, y: 0, z: 0, w: 0 } },
    tPortraitMouth0: { value: null },
    tPortraitMouth1: { value: null },
    tPortraitMouth2: { value: null },
    tPortraitMouth3: { value: null },
    tPortraitEyesInspect0: { value: null },
    tPortraitEyesInspect1: { value: null },
    tPortraitEyesInspect2: { value: null },
    tPortraitEyesInspect3: { value: null },
    tPortraitIdle0: { value: null },
    tPortraitIdle1: { value: null },
    tPortraitIdle2: { value: null },
    tPortraitIdle3: { value: null },
    mouthAr: { value: { x: 1, y: 1, z: 1, w: 1 } },
    idleAr: { value: { x: 1, y: 1, z: 1, w: 1 } },
    eyesInspectAr: { value: { x: 1, y: 1, z: 1, w: 1 } },
    portraitArtNudgeYPx: { value: 0.0 },
    portraitStatsRectPx0: { value: { x: 0, y: 0, z: 0, w: 0 } },
    portraitStatsRectPx1: { value: { x: 0, y: 0, z: 0, w: 0 } },
    portraitStatsRectPx2: { value: { x: 0, y: 0, z: 0, w: 0 } },
    portraitStatsRectPx3: { value: { x: 0, y: 0, z: 0, w: 0 } },
    navRectPx0: { value: { x: 0, y: 0, z: 0, w: 0 } },
    navRectPx1: { value: { x: 0, y: 0, z: 0, w: 0 } },
    navRectPx2: { value: { x: 0, y: 0, z: 0, w: 0 } },
    navRectPx3: { value: { x: 0, y: 0, z: 0, w: 0 } },
    navRectPx4: { value: { x: 0, y: 0, z: 0, w: 0 } },
    navRectPx5: { value: { x: 0, y: 0, z: 0, w: 0 } },
    navPushedOn01: { value: { x: 0, y: 0, z: 0, w: 0 } }, // [0..3]
    navPushedOn45: { value: { x: 0, y: 0, z: 0, w: 0 } }, // [4..5] in x,y
    tNavPushed: { value: null },
    resolution: { value: { x: 1, y: 1 } },
    gameRectPx: { value: { x: 0, y: 0, z: 1, w: 1 } }, // left, top, width, height in pixels
    // Room telegraph: full-viewport color tint over 3D scene only (no vignette).
    telegraphStrength: { value: 0.0 }, // 0..1 blend weight
    telegraphColor: { value: { x: 1.0, y: 1.0, z: 1.0 } },
    // 0 = multiply grade (debug/legacy), 1 = luma-preserving tint override (hazard rooms)
    telegraphTintMode: { value: 0.0 },
    /** Tint mode only: scales graded color (same hue); 1 = no pulse */
    telegraphTintPulse: { value: 1.0 },
    debugSceneMode: { value: 0.0 }, // 1 = show scene fullscreen; 2 = show center sample fullscreen
    debugSceneFlipY: { value: 1.0 }, // 1 = flip scene uv y
    debugRect: { value: 0.0 }, // 1 = draw gameRectPx outline
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
uniform vec4 portraitRectPx0;
uniform vec4 portraitRectPx1;
uniform vec4 portraitRectPx2;
uniform vec4 portraitRectPx3;
uniform vec4 mouthOn;
uniform vec4 idleOn;
uniform vec4 eyesInspectOn;
uniform sampler2D tPortraitMouth0;
uniform sampler2D tPortraitMouth1;
uniform sampler2D tPortraitMouth2;
uniform sampler2D tPortraitMouth3;
uniform sampler2D tPortraitEyesInspect0;
uniform sampler2D tPortraitEyesInspect1;
uniform sampler2D tPortraitEyesInspect2;
uniform sampler2D tPortraitEyesInspect3;
uniform sampler2D tPortraitIdle0;
uniform sampler2D tPortraitIdle1;
uniform sampler2D tPortraitIdle2;
uniform sampler2D tPortraitIdle3;
uniform vec4 mouthAr;
uniform vec4 idleAr;
uniform vec4 eyesInspectAr;
uniform float portraitArtNudgeYPx;
uniform vec4 portraitStatsRectPx0;
uniform vec4 portraitStatsRectPx1;
uniform vec4 portraitStatsRectPx2;
uniform vec4 portraitStatsRectPx3;
uniform vec4 navRectPx0;
uniform vec4 navRectPx1;
uniform vec4 navRectPx2;
uniform vec4 navRectPx3;
uniform vec4 navRectPx4;
uniform vec4 navRectPx5;
uniform vec4 navPushedOn01;
uniform vec4 navPushedOn45;
uniform sampler2D tNavPushed;
uniform vec2 resolution;
uniform vec4 gameRectPx;
uniform float telegraphStrength;
uniform vec3 telegraphColor;
uniform float telegraphTintMode;
uniform float telegraphTintPulse;
uniform float debugSceneMode;
uniform float debugSceneFlipY;
uniform float debugRect;
varying vec2 vUv;

bool insideRect(vec2 p, vec4 r) {
  return p.x >= r.x && p.y >= r.y && p.x < (r.x + r.z) && p.y < (r.y + r.w);
}

vec4 over(vec4 under, vec4 overC) {
  float a = clamp(overC.a, 0.0, 1.0);
  vec3 rgb = under.rgb * (1.0 - a) + overC.rgb * a;
  float outA = under.a + a * (1.0 - under.a);
  return vec4(rgb, outA);
}

// Compositor idle runs before the next html2canvas snapshot; stale uiTex can still show base+eyes
// under semi-opaque idle. Clear captured UI only where the idle texture has real coverage so we
// do not wipe the portrait backdrop (gradient) behind fully transparent idle pixels (would read black).
vec4 killStaleUiUnderCompositorIdle(
  vec2 px,
  vec4 uiIn,
  vec4 rectPx,
  vec4 statsRectPx,
  float idleOn1,
  float idleAr1,
  sampler2D tIdle
) {
  if (idleOn1 < 0.5) return uiIn;
  if (rectPx.z <= 1.0 || rectPx.w <= 1.0) return uiIn;
  if (!insideRect(px, rectPx)) return uiIn;
  if (statsRectPx.z > 1.0 && statsRectPx.w > 1.0 && insideRect(px, statsRectPx)) return uiIn;
  vec2 localPx = px - rectPx.xy;
  float rectW = rectPx.z;
  float rectH = rectPx.w;
  float ar = max(1e-6, idleAr1);
  float spriteW = rectH * ar;
  float left = rectW * 0.5 - spriteW * 0.5;
  float u = (localPx.x - left) / max(1.0, spriteW);
  float v = (localPx.y - portraitArtNudgeYPx) / max(1.0, rectH);
  if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
    float vTex = 1.0 - v;
    float idleA = texture2D(tIdle, vec2(u, vTex)).a;
    if (idleA > 0.008) {
      return vec4(0.0);
    }
  }
  return uiIn;
}

vec4 samplePortraitOverlay(
  vec2 px,
  vec4 rectPx,
  vec4 statsRectPx,
  float mouthOn1,
  float idleOn1,
  float eyesOn1,
  sampler2D tMouth,
  sampler2D tEyes,
  sampler2D tIdle,
  float mouthAr1,
  float eyesAr1,
  float idleAr1
) {
  if (rectPx.z <= 1.0 || rectPx.w <= 1.0) return vec4(0.0);
  if (!insideRect(px, rectPx)) return vec4(0.0);
  // Never draw overlays over the stats UI region.
  if (statsRectPx.z > 1.0 && statsRectPx.w > 1.0 && insideRect(px, statsRectPx)) return vec4(0.0);
  vec2 localPx = px - rectPx.xy;
  vec4 c = vec4(0.0);

  // Match DOM sprite layout (PortraitPanel.module.css):
  // - sprite is centered in rect
  // - sprite height = rect height (width auto by texture aspect ratio)
  // - sprite is nudged vertically by the portrait art nudge (in px)
  float rectW = rectPx.z;
  float rectH = rectPx.w;

  // Idle overlay (if active).
  if (idleOn1 > 0.5) {
    float ar = max(1e-6, idleAr1);
    float spriteW = rectH * ar;
    float left = rectW * 0.5 - spriteW * 0.5;
    float u = (localPx.x - left) / max(1.0, spriteW);
    float v = (localPx.y - portraitArtNudgeYPx) / max(1.0, rectH);
    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
      v = 1.0 - v; // top-origin to texture UV
      vec4 idleS = texture2D(tIdle, vec2(u, v));

      // Force-occlude the portrait "eyes" band during idle so captured eye sprites
      // can't show through due to HUD capture latency or idle sprite transparency.
      // This matches the DOM hitbox for eyes: left 12% width 76%, top 20% height 28%.
      vec2 local01 = vec2(localPx.x / max(1.0, rectW), localPx.y / max(1.0, rectH));
      bool inEyesBand =
        local01.x >= 0.12 && local01.x <= (0.12 + 0.76) &&
        local01.y >= 0.20 && local01.y <= (0.20 + 0.28);
      if (inEyesBand) {
        // Make the idle overlay fully cover the eyes band during idle, but only where the
        // idle sprite already has coverage. This avoids a rectangular “bar” at silhouette edges.
        if (idleS.a > 0.001) idleS.a = 1.0;
      }

      c = over(c, idleS);
    }
  }

  // Eyes-inspect overlay (if active).
  if (eyesOn1 > 0.5) {
    float ar = max(1e-6, eyesAr1);
    float spriteW = rectH * ar;
    float left = rectW * 0.5 - spriteW * 0.5;
    float u = (localPx.x - left) / max(1.0, spriteW);
    float v = (localPx.y - portraitArtNudgeYPx) / max(1.0, rectH);
    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
      v = 1.0 - v;
      c = over(c, texture2D(tEyes, vec2(u, v)));
    }
  }

  // Mouth overlay (if active).
  if (mouthOn1 > 0.5) {
    float ar = max(1e-6, mouthAr1);
    float spriteW = rectH * ar;
    float left = rectW * 0.5 - spriteW * 0.5;
    float u = (localPx.x - left) / max(1.0, spriteW);
    float v = (localPx.y - portraitArtNudgeYPx) / max(1.0, rectH);
    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
      v = 1.0 - v; // top-origin to texture UV
      c = over(c, texture2D(tMouth, vec2(u, v)));
    }
  }
  return c;
}

vec4 sampleNavPushed(vec2 px, vec4 rectPx, float on1) {
  if (on1 < 0.5) return vec4(0.0);
  if (rectPx.z <= 1.0 || rectPx.w <= 1.0) return vec4(0.0);
  if (!insideRect(px, rectPx)) return vec4(0.0);
  vec2 local = px - rectPx.xy;
  vec2 uv = vec2(local.x / max(1.0, rectPx.z), 1.0 - (local.y / max(1.0, rectPx.w)));
  return texture2D(tNavPushed, clamp(uv, 0.0, 1.0));
}

void main() {
  // Use gl_FragCoord so DPR/pixelRatio is handled correctly.
  // DOM rects (getBoundingClientRect) are top-origin; gl_FragCoord is bottom-origin.
  vec2 px = vec2(gl_FragCoord.x, resolution.y - gl_FragCoord.y);
  vec4 ui = texture2D(tUi, vUv);
  ui = killStaleUiUnderCompositorIdle(px, ui, portraitRectPx0, portraitStatsRectPx0, idleOn.x, idleAr.x, tPortraitIdle0);
  ui = killStaleUiUnderCompositorIdle(px, ui, portraitRectPx1, portraitStatsRectPx1, idleOn.y, idleAr.y, tPortraitIdle1);
  ui = killStaleUiUnderCompositorIdle(px, ui, portraitRectPx2, portraitStatsRectPx2, idleOn.z, idleAr.z, tPortraitIdle2);
  ui = killStaleUiUnderCompositorIdle(px, ui, portraitRectPx3, portraitStatsRectPx3, idleOn.w, idleAr.w, tPortraitIdle3);

  // Portrait reaction overlays: render *over* captured UI so they appear above the portrait base art,
  // while still masking out the stats UI region (see samplePortraitOverlay).
  vec4 o0 = samplePortraitOverlay(px, portraitRectPx0, portraitStatsRectPx0, mouthOn.x, idleOn.x, eyesInspectOn.x, tPortraitMouth0, tPortraitEyesInspect0, tPortraitIdle0, mouthAr.x, eyesInspectAr.x, idleAr.x);
  vec4 o1 = samplePortraitOverlay(px, portraitRectPx1, portraitStatsRectPx1, mouthOn.y, idleOn.y, eyesInspectOn.y, tPortraitMouth1, tPortraitEyesInspect1, tPortraitIdle1, mouthAr.y, eyesInspectAr.y, idleAr.y);
  vec4 o2 = samplePortraitOverlay(px, portraitRectPx2, portraitStatsRectPx2, mouthOn.z, idleOn.z, eyesInspectOn.z, tPortraitMouth2, tPortraitEyesInspect2, tPortraitIdle2, mouthAr.z, eyesInspectAr.z, idleAr.z);
  vec4 o3 = samplePortraitOverlay(px, portraitRectPx3, portraitStatsRectPx3, mouthOn.w, idleOn.w, eyesInspectOn.w, tPortraitMouth3, tPortraitEyesInspect3, tPortraitIdle3, mouthAr.w, eyesInspectAr.w, idleAr.w);
  vec4 overUi = over(over(over(o0, o1), o2), o3);
  ui = over(ui, overUi);

  // Navigation button "pushed" overlay (instant, no capture needed).
  ui = over(ui, sampleNavPushed(px, navRectPx0, navPushedOn01.x));
  ui = over(ui, sampleNavPushed(px, navRectPx1, navPushedOn01.y));
  ui = over(ui, sampleNavPushed(px, navRectPx2, navPushedOn01.z));
  ui = over(ui, sampleNavPushed(px, navRectPx3, navPushedOn01.w));
  ui = over(ui, sampleNavPushed(px, navRectPx4, navPushedOn45.x));
  ui = over(ui, sampleNavPushed(px, navRectPx5, navPushedOn45.y));

  // Optional debug outline for the rect (drawn over everything so it’s always visible).
  if (debugRect > 0.5) {
    float t = 3.0; // thickness in pixels
    float x0 = gameRectPx.x;
    float y0 = gameRectPx.y;
    float x1 = gameRectPx.x + gameRectPx.z;
    float y1 = gameRectPx.y + gameRectPx.w;

    float inX = step(x0, px.x) * step(px.x, x1);
    float inY = step(y0, px.y) * step(px.y, y1);

    float left = step(x0, px.x) * step(px.x, x0 + t);
    float right = step(x1 - t, px.x) * step(px.x, x1);
    float top = step(y0, px.y) * step(px.y, y0 + t);
    float bottom = step(y1 - t, px.y) * step(px.y, y1);

    float edge = (left + right) * inY + (top + bottom) * inX;
    if (edge > 0.0) {
      gl_FragColor = vec4(1.0, 0.25, 0.75, 1.0);
      return;
    }
  }

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

  // Room-property telegraph: uniform blend over the 3D viewport (no radial vignette).
  float teleS = clamp(telegraphStrength, 0.0, 1.0);
  if (teleS > 1e-5) {
    float a = teleS;
    if (telegraphTintMode > 0.5) {
      // Luma-preserving color tint: overrides floor/theme cast without a flat opaque overlay.
      // Pulse scales graded only (fixed tc ratios) so hue does not swing toward scene colors.
      float L = dot(scene.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 tc = clamp(telegraphColor, 0.0, 1.0);
      float pulse = clamp(telegraphTintPulse, 0.35, 1.35);
      vec3 graded = tc * clamp(L * 1.45, 0.06, 1.0) * pulse;
      scene.rgb = mix(scene.rgb, graded, a);
    } else {
      vec3 mul = clamp(telegraphColor, 0.0, 4.0);
      vec3 tinted = scene.rgb * mul;
      scene.rgb = mix(scene.rgb, tinted, a);
    }
  }

  gl_FragColor = scene * (1.0 - ui.a) + ui;
}
`,
}

