export const DitherShader = {
  uniforms: {
    tDiffuse: { value: null },
    strength: { value: 0.75 },
    colourPreserve: { value: 0.6 },
    pixelSize: { value: 1.0 },
    levels: { value: 10.0 },
    matrixSize: { value: 4.0 }, // 2, 4, 8
    palette: { value: 0.0 }, // 0..4
    /** When palette is 0 (warm dungeon): 0 = quantised dither only, 1 = full warm snap. */
    palette0Mix: { value: 1.0 },
    /** Post-dither contrast/levels. 1 = neutral. */
    postLevels: { value: 1.0 },
    /** Post-dither lift (additive). 0 = neutral. */
    postLift: { value: 0.0 },
    /** Post-dither gamma. 1 = neutral. */
    postGamma: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float strength;
uniform float colourPreserve;
uniform float pixelSize;
uniform float levels;
uniform float matrixSize;
uniform float palette;
uniform float palette0Mix;
uniform float postLevels;
uniform float postLift;
uniform float postGamma;
varying vec2 vUv;

float bayer2(vec2 p) {
  // 2x2: [0 2; 3 1] / 4
  int x = int(mod(p.x, 2.0));
  int y = int(mod(p.y, 2.0));
  if (x==0 && y==0) return 0.0;
  if (x==1 && y==0) return 2.0;
  if (x==0 && y==1) return 3.0;
  return 1.0;
}

float bayer4(vec2 p) {
  // 4x4 from classic Bayer matrix values 0..15
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int idx = x + y * 4;
  int m[16];
  m[0]=0; m[1]=8; m[2]=2; m[3]=10;
  m[4]=12; m[5]=4; m[6]=14; m[7]=6;
  m[8]=3; m[9]=11; m[10]=1; m[11]=9;
  m[12]=15; m[13]=7; m[14]=13; m[15]=5;
  return float(m[idx]);
}

float bayer8(vec2 p) {
  // 8x8 constructed by recursive Bayer; hardcode as 0..63
  int x = int(mod(p.x, 8.0));
  int y = int(mod(p.y, 8.0));
  int idx = x + y * 8;
  int m[64];
  m[0]=0; m[1]=32; m[2]=8; m[3]=40; m[4]=2; m[5]=34; m[6]=10; m[7]=42;
  m[8]=48; m[9]=16; m[10]=56; m[11]=24; m[12]=50; m[13]=18; m[14]=58; m[15]=26;
  m[16]=12; m[17]=44; m[18]=4; m[19]=36; m[20]=14; m[21]=46; m[22]=6; m[23]=38;
  m[24]=60; m[25]=28; m[26]=52; m[27]=20; m[28]=62; m[29]=30; m[30]=54; m[31]=22;
  m[32]=3; m[33]=35; m[34]=11; m[35]=43; m[36]=1; m[37]=33; m[38]=9; m[39]=41;
  m[40]=51; m[41]=19; m[42]=59; m[43]=27; m[44]=49; m[45]=17; m[46]=57; m[47]=25;
  m[48]=15; m[49]=47; m[50]=7; m[51]=39; m[52]=13; m[53]=45; m[54]=5; m[55]=37;
  m[56]=63; m[57]=31; m[58]=55; m[59]=23; m[60]=61; m[61]=29; m[62]=53; m[63]=21;
  return float(m[idx]);
}

float bayer(vec2 p, float size) {
  if (size < 3.0) return bayer2(p) / 4.0;
  if (size < 6.0) return bayer4(p) / 16.0;
  return bayer8(p) / 64.0;
}

vec3 paletteColor(int pal, int idx) {
  // 0 warm dungeon, 1 cold crypt, 2 mono, 3 sepia, 4 none (handled elsewhere)
  if (pal == 0) {
    vec3 c[5];
    c[0]=vec3(0.05,0.04,0.06);
    c[1]=vec3(0.22,0.16,0.14);
    c[2]=vec3(0.55,0.34,0.22);
    c[3]=vec3(0.85,0.63,0.33);
    c[4]=vec3(1.00,0.92,0.72);
    return c[idx];
  }
  if (pal == 1) {
    vec3 c[5];
    c[0]=vec3(0.03,0.05,0.08);
    c[1]=vec3(0.10,0.18,0.22);
    c[2]=vec3(0.22,0.34,0.38);
    c[3]=vec3(0.55,0.75,0.78);
    c[4]=vec3(0.92,0.98,1.00);
    return c[idx];
  }
  if (pal == 2) {
    vec3 c[5];
    c[0]=vec3(0.06);
    c[1]=vec3(0.22);
    c[2]=vec3(0.44);
    c[3]=vec3(0.70);
    c[4]=vec3(0.92);
    return c[idx];
  }
  // sepia
  vec3 c[5];
  c[0]=vec3(0.05,0.04,0.03);
  c[1]=vec3(0.25,0.19,0.12);
  c[2]=vec3(0.48,0.37,0.22);
  c[3]=vec3(0.72,0.58,0.38);
  c[4]=vec3(0.95,0.86,0.68);
  return c[idx];
}

vec3 snapToPalette(vec3 col, int pal) {
  float best = 1e9;
  vec3 outc = col;
  for (int i=0;i<5;i++){
    vec3 p = paletteColor(pal, i);
    float d = dot(col-p, col-p);
    if (d < best) { best = d; outc = p; }
  }
  return outc;
}

vec3 quantize(vec3 col, float steps) {
  return floor(col * (steps - 1.0) + 0.5) / (steps - 1.0);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 pix = floor(frag / max(1.0, pixelSize)) * max(1.0, pixelSize);
  vec2 uv = vUv;

  vec4 src = texture2D(tDiffuse, uv);
  vec3 col = src.rgb;

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 mono = vec3(luma);
  col = mix(mono, col, clamp(colourPreserve, 0.0, 1.0));

  float d = bayer(pix, matrixSize) - 0.5;
  float s = max(2.0, levels);
  vec3 q = quantize(col + d / s, s);

  int pal = int(floor(palette + 0.5));
  vec3 snapped;
  if (pal >= 4) {
    snapped = q;
  } else if (pal == 0) {
    vec3 warm = snapToPalette(q, 0);
    snapped = mix(q, warm, clamp(palette0Mix, 0.0, 1.0));
  } else {
    snapped = snapToPalette(q, pal);
  }

  vec3 outc = mix(src.rgb, snapped, clamp(strength, 0.0, 1.0));
  // Post-dither lift/gain/gamma (classic levels). All are neutral at 0/1/1.
  float gain = max(0.0, postLevels);
  float lift = postLift;
  float gamma = max(1e-6, postGamma);
  outc = clamp(outc * gain + lift, 0.0, 1.0);
  outc = pow(outc, vec3(1.0 / gamma));
  gl_FragColor = vec4(outc, 1.0);
}
`,
}

