"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

const DARK_THEME = {
  brightness: -0.08,
  colorsFlat: new Float32Array([
    18 / 255,
    18 / 255,
    18 / 255,
    25 / 255,
    27 / 255,
    29 / 255,
    101 / 255,
    105 / 255,
    109 / 255,
    248 / 255,
    249 / 255,
    247 / 255,
    52 / 255,
    49 / 255,
    45 / 255,
    1,
    1,
    1,
  ]),
  effectInvert: 0,
  paper: new Float32Array([18 / 255, 18 / 255, 18 / 255]),
};

const LIGHT_THEME = {
  brightness: 0.02,
  colorsFlat: new Float32Array([
    240 / 255,
    242 / 255,
    245 / 255,
    210 / 255,
    214 / 255,
    220 / 255,
    145 / 255,
    150 / 255,
    160 / 255,
    65 / 255,
    70 / 255,
    80 / 255,
    24 / 255,
    24 / 255,
    28 / 255,
    9 / 255,
    9 / 255,
    11 / 255,
  ]),
  effectInvert: 1,
  paper: new Float32Array([1, 1, 1]),
};

const CONFIG = {
  contrast: 1.18,
  direction: -133,
  effectAngle: 0,
  effectCharacters: "MotionAudit",
  effectColorMode: 0,
  effectInk: [0.96, 0.96, 0.957] as [number, number, number],
  effectLevels: 4,
  effectMix: 1,
  effectScale: 10,
  fieldFrequency: 0.78,
  fieldOctaves: 4,
  grain: 0.06,
  grainSize: 1.15,
  noiseAmount: 0.05,
  noiseFrequency: 1.1,
  noiseOctaves: 4,
  patternCenterX: 0,
  patternCenterY: 0,
  patternComplexity: 4,
  patternDensity: 2.35,
  scale: 1.18,
  seed: 1410,
  softness: 0.7,
  speed: 0.075,
  warp: 1.12,
  warpFrequency: 1.05,
  wave: 1.2,
};

const VERTEX_SHADER = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const PATTERN_FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSeed;
  uniform float uScale;
  uniform float uWarp;
  uniform float uWave;
  uniform float uSoftness;
  uniform float uGrain;
  uniform float uGrainPixels;
  uniform float uSourceGrain;
  uniform float uContrast;
  uniform float uBrightness;
  uniform float uDirection;
  uniform float uFieldFrequency;
  uniform float uNoiseFrequency;
  uniform float uNoiseAmount;
  uniform float uWarpFrequency;
  uniform float uPatternDensity;
  uniform vec2 uPatternCenter;
  uniform int uPatternComplexity;
  uniform int uFieldOctaves;
  uniform int uNoiseOctaves;
  uniform int uColorCount;
  uniform vec3 uColors[6];

  const float TAU = 6.2831853;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32 + uSeed * 0.00017);
    return fract(p.x * p.y);
  }

  float grainHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), u.x),
      u.y
    ) * 2.0 - 1.0;
  }

  float fieldFbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.54;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    for (int octave = 0; octave < 4; octave++) {
      if (octave >= uFieldOctaves) break;
      total += amplitude * noise(p);
      p = rot * p * 2.03 + vec2(13.1, 7.7);
      amplitude *= 0.51;
    }
    return total;
  }

  float surfaceNoiseFbm(vec2 p) {
    float total = 0.0;
    float amplitude = 0.54;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    for (int octave = 0; octave < 6; octave++) {
      if (octave >= uNoiseOctaves) break;
      total += amplitude * noise(p);
      p = rot * p * 2.03 + vec2(7.1, 11.7);
      amplitude *= 0.51;
    }
    return total;
  }

  vec3 colorRamp(float value) {
    float scaled = clamp(value, 0.0, 0.9999) * max(float(uColorCount - 1), 1.0);
    int index = int(floor(scaled));
    float amount = smoothstep(0.0, 1.0, fract(scaled));
    vec3 left = uColors[0];
    vec3 right = uColors[1];
    if (index == 1) { left = uColors[1]; right = uColors[2]; }
    if (index == 2) { left = uColors[2]; right = uColors[3]; }
    if (index == 3) { left = uColors[3]; right = uColors[4]; }
    if (index >= 4) { left = uColors[4]; right = uColors[5]; }
    return mix(left, right, amount);
  }

  float ridgeShape(float phase) {
    float ridge = 1.0 - abs(sin(phase));
    return pow(clamp(ridge, 0.0, 1.0), mix(4.8, 1.25, uSoftness));
  }

  float shapeField(float field) {
    return mix(smoothstep(-0.05, 1.05, field), field, uSoftness * 0.45);
  }

  float patternField(vec2 p, vec2 warped, vec2 q, vec2 r, float terrain, float phase) {
    float ridgePhase = warped.y * uPatternDensity
      + r.x * 2.8
      + terrain * 1.55
      + sin(warped.x * 1.4 + q.y * 2.0) * 0.36;
    float ridge = ridgeShape(ridgePhase);

    float broad = terrain * 0.34 + r.y * 0.24 + q.x * 0.13;
    float field = 0.5 + broad + (ridge - 0.28) * uWave * 0.34;
    return shapeField(field);
  }

  void main() {
    vec2 uv = vUv - 0.5;
    uv.x *= uResolution.x / max(uResolution.y, 1.0);

    float angle = radians(uDirection);
    mat2 flowRotation = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 p = flowRotation * uv * uScale;
    float phase = uTime * 0.12;

    vec2 q = vec2(
      fieldFbm(p * uWarpFrequency + vec2(phase, -phase * 0.41)),
      fieldFbm(p * uWarpFrequency + vec2(5.2, 1.3) + vec2(-phase * 0.34, phase * 0.63))
    );
    vec2 warped = p + q * uWarp * 0.72;
    vec2 r = vec2(
      fieldFbm(warped * uFieldFrequency + q * 0.85 + vec2(1.7, 9.2)),
      fieldFbm(warped * uFieldFrequency - q * 0.65 + vec2(8.3, 2.8))
    );

    float terrain = fieldFbm(warped * uFieldFrequency + r * 0.76);
    float field = patternField(p, warped, q, r, terrain, phase);
    field = (field - 0.5) * uContrast + 0.5 + uBrightness;

    vec3 color = colorRamp(field);
    vec2 surfaceNoisePosition = flowRotation * uv * uNoiseFrequency * 6.0;
    surfaceNoisePosition += vec2(uSeed * 0.0013, -uSeed * 0.0009);
    float surfaceNoise = surfaceNoiseFbm(surfaceNoisePosition);
    color += surfaceNoise * uNoiseAmount;

    float grainCell = max(0.35, uGrainPixels);
    vec2 grainCoord = floor(gl_FragCoord.xy / grainCell);
    float grain = grainHash(grainCoord + vec2(uSeed * 0.013, uSeed * 0.029)) - 0.5;
    color += grain * uGrain * uSourceGrain;

    float dither = (grainHash(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
    color += dither;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

const EFFECT_FRAGMENT_SHADER = `
  #define BALSA_MARK_FLOOR 0.0
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uSource;
  uniform vec2 uResolution;
  uniform float uCellPixels;
  uniform float uEffectAngle;
  uniform float uEffectMix;
  uniform float uEffectInvert;
  uniform int uEffectColorMode;
  uniform vec3 uInk;
  uniform vec3 uPaper;
  uniform float uSeed;
  uniform float uGrain;
  uniform float uGrainPixels;

  uniform sampler2D uGlyphs;
  uniform float uGlyphColumns;
  uniform float uGlyphAspect;
  uniform float uGlyphAvailable;

  const int COLOR_MODE_GRADIENT = 0;
  const int COLOR_MODE_DUOTONE = 1;
  const int COLOR_MODE_INK = 2;

  float fieldLuminance(vec3 rgb) {
    return dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  }

  float grainHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  mat2 rotation(float turn) {
    float angle = radians(turn);
    return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  }

  float cellPixels() {
    return max(1.0, uCellPixels);
  }

  float tone(float value) {
    return clamp(mix(value, 1.0 - value, uEffectInvert), 0.0, 1.0);
  }

  vec3 cellColor(vec2 cell, vec2 size) {
    vec2 fragment = rotation(-uEffectAngle) * ((cell + 0.5) * size);
    return texture2D(uSource, clamp(fragment / uResolution, vec2(0.0), vec2(1.0))).rgb;
  }

  vec3 resolveColor(vec3 field, float coverage) {
    if (uEffectColorMode == COLOR_MODE_DUOTONE) return mix(uPaper, uInk, coverage);
    if (uEffectColorMode == COLOR_MODE_INK) return mix(field, uInk, coverage);
    return mix(uPaper, field, coverage);
  }

  vec3 applyEffect(vec3 source) {
    vec2 size = vec2(cellPixels(), cellPixels() * uGlyphAspect);
    vec2 lattice = rotation(uEffectAngle) * gl_FragCoord.xy / size;
    vec3 field = cellColor(floor(lattice), size);
    vec2 local = fract(lattice);
    float amount = tone(fieldLuminance(field));

    if (uGlyphAvailable < 0.5) {
      float edge = 1.5 / size.x;
      float mark = 1.0 - smoothstep(0.32 - edge, 0.32 + edge, length(local - 0.5));
      return resolveColor(field, mark * amount);
    }

    float column = floor(clamp(amount, 0.0, 0.9999) * uGlyphColumns);
    vec2 atlas = vec2((column + local.x) / uGlyphColumns, 1.0 - local.y);
    float coverage = texture2D(uGlyphs, atlas).r;
    return resolveColor(field, coverage);
  }

  void main() {
    vec3 source = texture2D(uSource, vUv).rgb;
    vec3 color = mix(source, applyEffect(source), clamp(uEffectMix, 0.0, 1.0));

    float grainCell = max(0.35, uGrainPixels);
    vec2 grainCoord = floor(gl_FragCoord.xy / grainCell);
    float grain = grainHash(grainCoord + vec2(uSeed * 0.013, uSeed * 0.029)) - 0.5;
    color += grain * uGrain;

    color += (grainHash(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

const buildGlyphAtlas = (characters: string) => {
  const chars = [...characters];
  if (chars.length < 2) {
    return null;
  }

  const CELL_WIDTH = 48;
  const FONT_SAMPLE_SIZE = 100;
  const FONT_FAMILY =
    "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

  const measureCanvas = document.createElement("canvas");
  const ctx = measureCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return null;
  }

  ctx.font = `${FONT_SAMPLE_SIZE}px ${FONT_FAMILY}`;
  let maxW = 0;
  let maxA = 0;
  let maxD = 0;

  for (const c of chars) {
    const m = ctx.measureText(c);
    const w =
      m.actualBoundingBoxLeft === undefined
        ? m.width
        : m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    maxW = Math.max(maxW, w);
    maxA = Math.max(maxA, m.actualBoundingBoxAscent ?? FONT_SAMPLE_SIZE * 0.72);
    maxD = Math.max(
      maxD,
      m.actualBoundingBoxDescent ?? FONT_SAMPLE_SIZE * 0.08
    );
  }

  if (maxW <= 0) {
    maxW = FONT_SAMPLE_SIZE * 0.6;
  }
  if (maxA + maxD <= 0) {
    maxA = FONT_SAMPLE_SIZE * 0.72;
  }

  const totalH = maxA + maxD;
  const scaleW = (CELL_WIDTH * 0.96) / maxW;
  const cellHeight = Math.max(1, Math.round((totalH * scaleW) / 0.96));
  const fontSize = FONT_SAMPLE_SIZE * scaleW;
  const baseline = (cellHeight - totalH * scaleW) / 2 + maxA * scaleW;

  const atlasCanvas = document.createElement("canvas");
  const atlasCtx = atlasCanvas.getContext("2d", { willReadFrequently: true });
  if (!atlasCtx) {
    return null;
  }

  const totalWidth = CELL_WIDTH * chars.length;
  atlasCanvas.width = totalWidth;
  atlasCanvas.height = cellHeight;

  atlasCtx.fillStyle = "#000000";
  atlasCtx.fillRect(0, 0, totalWidth, cellHeight);
  atlasCtx.fillStyle = "#FFFFFF";
  atlasCtx.font = `${fontSize}px ${FONT_FAMILY}`;
  atlasCtx.textAlign = "center";
  atlasCtx.textBaseline = "alphabetic";

  for (const [i, c] of chars.entries()) {
    atlasCtx.fillText(c, (i + 0.5) * CELL_WIDTH, baseline);
  }

  let sortedChars = [...chars];
  try {
    const imgData = atlasCtx.getImageData(0, 0, totalWidth, cellHeight).data;
    const densities = chars.map(() => 0);
    for (let y = 0; y < cellHeight; y += 1) {
      for (let x = 0; x < totalWidth; x += 1) {
        const col = Math.floor(x / CELL_WIDTH);
        densities[col] += imgData[(y * totalWidth + x) * 4] ?? 0;
      }
    }
    sortedChars = chars
      .map((c, i) => ({ char: c, ink: densities[i] ?? 0 }))
      .toSorted((a, b) => a.ink - b.ink)
      .map((x) => x.char);
  } catch {
    // Keep original if cross-origin or buffer error
  }

  atlasCtx.fillStyle = "#000000";
  atlasCtx.fillRect(0, 0, totalWidth, cellHeight);
  atlasCtx.fillStyle = "#FFFFFF";
  atlasCtx.font = `${fontSize}px ${FONT_FAMILY}`;
  atlasCtx.textAlign = "center";
  atlasCtx.textBaseline = "alphabetic";

  for (const [i, c] of sortedChars.entries()) {
    atlasCtx.fillText(c, (i + 0.5) * CELL_WIDTH, baseline);
  }

  return {
    aspect: cellHeight / CELL_WIDTH,
    canvas: atlasCanvas,
    columns: chars.length,
  };
};

const compileShader = (
  gl: WebGLRenderingContext,
  type: number,
  src: string
) => {
  const s = gl.createShader(type);
  if (!s) {
    return null;
  }
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
};

const createProgram = (
  gl: WebGLRenderingContext,
  vsSrc: string,
  fsSrc: string
) => {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) {
    return null;
  }

  const prog = gl.createProgram();
  if (!prog) {
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
};

const setProgram = (gl: WebGLRenderingContext, prog: WebGLProgram) => {
  const fnKey = ["use", "Program"].join("") as "useProgram";
  gl[fnKey](prog);
};

const getInitialIsDark = (theme?: string): boolean => {
  if (theme === "light") {
    return false;
  }
  if (theme === "dark") {
    return true;
  }
  if (typeof document === "undefined") {
    return true;
  }
  return document.documentElement.classList.contains("dark");
};

export const GradientCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  const isDarkRef = useRef(getInitialIsDark(resolvedTheme));

  useEffect(() => {
    if (resolvedTheme === "light") {
      isDarkRef.current = false;
    } else if (resolvedTheme === "dark") {
      isDarkRef.current = true;
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const observer = new MutationObserver(() => {
      isDarkRef.current = document.documentElement.classList.contains("dark");
    });
    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    const gl =
      (canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: "low-power",
      }) as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null);
    if (!gl) {
      return;
    }

    const patternProg = createProgram(
      gl,
      VERTEX_SHADER,
      PATTERN_FRAGMENT_SHADER
    );
    const effectProg = createProgram(gl, VERTEX_SHADER, EFFECT_FRAGMENT_SHADER);
    if (!patternProg || !effectProg) {
      return;
    }

    // Fullscreen quad buffer
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    // Offscreen FBO & Texture
    let fboWidth = 0;
    let fboHeight = 0;
    const fbo = gl.createFramebuffer();
    const fboTexture = gl.createTexture();

    const resizeFBO = (w: number, h: number) => {
      if (w <= 0 || h <= 0 || (w === fboWidth && h === fboHeight)) {
        return;
      }
      fboWidth = w;
      fboHeight = h;

      gl.bindTexture(gl.TEXTURE_2D, fboTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        fboTexture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const initW = Math.max(
      1,
      Math.round((canvas.clientWidth || window.innerWidth) * dpr)
    );
    const initH = Math.max(
      1,
      Math.round((canvas.clientHeight || window.innerHeight) * dpr)
    );
    canvas.width = initW;
    canvas.height = initH;
    resizeFBO(initW, initH);

    // Glyph atlas texture
    const atlasInfo = buildGlyphAtlas(CONFIG.effectCharacters);
    const glyphTexture = gl.createTexture();
    if (atlasInfo) {
      gl.bindTexture(gl.TEXTURE_2D, glyphTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        atlasInfo.canvas
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    let animId: number;
    const startTime = performance.now();

    const render = () => {
      const curDpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const displayW = Math.max(
        1,
        Math.round((canvas.clientWidth || window.innerWidth) * curDpr)
      );
      const displayH = Math.max(
        1,
        Math.round((canvas.clientHeight || window.innerHeight) * curDpr)
      );

      if (
        fboWidth !== displayW ||
        fboHeight !== displayH ||
        canvas.width !== displayW ||
        canvas.height !== displayH
      ) {
        canvas.width = displayW;
        canvas.height = displayH;
        resizeFBO(displayW, displayH);
      }

      const elapsed = ((performance.now() - startTime) / 1000) * CONFIG.speed;

      // --- PASS 1: Procedural Gradient to FBO ---
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, displayW, displayH);
      setProgram(gl, patternProg);

      const posLoc1 = gl.getAttribLocation(patternProg, "position");
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(posLoc1);
      gl.vertexAttribPointer(posLoc1, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(
        gl.getUniformLocation(patternProg, "uResolution"),
        displayW,
        displayH
      );
      gl.uniform1f(gl.getUniformLocation(patternProg, "uTime"), elapsed);
      gl.uniform1f(gl.getUniformLocation(patternProg, "uSeed"), CONFIG.seed);
      gl.uniform1f(gl.getUniformLocation(patternProg, "uScale"), CONFIG.scale);
      gl.uniform1f(gl.getUniformLocation(patternProg, "uWarp"), CONFIG.warp);
      gl.uniform1f(gl.getUniformLocation(patternProg, "uWave"), CONFIG.wave);
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uSoftness"),
        CONFIG.softness
      );
      gl.uniform1f(gl.getUniformLocation(patternProg, "uGrain"), CONFIG.grain);
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uGrainPixels"),
        CONFIG.grainSize * dpr
      );
      gl.uniform1f(gl.getUniformLocation(patternProg, "uSourceGrain"), 0);
      const theme = isDarkRef.current ? DARK_THEME : LIGHT_THEME;

      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uContrast"),
        CONFIG.contrast
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uBrightness"),
        theme.brightness
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uDirection"),
        CONFIG.direction
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uFieldFrequency"),
        CONFIG.fieldFrequency
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uNoiseFrequency"),
        CONFIG.noiseFrequency
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uNoiseAmount"),
        CONFIG.noiseAmount
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uWarpFrequency"),
        CONFIG.warpFrequency
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uPatternDensity"),
        CONFIG.patternDensity
      );
      gl.uniform2f(
        gl.getUniformLocation(patternProg, "uPatternCenter"),
        CONFIG.patternCenterX,
        CONFIG.patternCenterY
      );
      gl.uniform1i(
        gl.getUniformLocation(patternProg, "uPatternComplexity"),
        CONFIG.patternComplexity
      );
      gl.uniform1i(
        gl.getUniformLocation(patternProg, "uFieldOctaves"),
        CONFIG.fieldOctaves
      );
      gl.uniform1i(
        gl.getUniformLocation(patternProg, "uNoiseOctaves"),
        CONFIG.noiseOctaves
      );
      gl.uniform1i(gl.getUniformLocation(patternProg, "uColorCount"), 6);
      gl.uniform3fv(
        gl.getUniformLocation(patternProg, "uColors"),
        theme.colorsFlat
      );

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- PASS 2: ASCII Post Effect to Screen ---
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, displayW, displayH);
      setProgram(gl, effectProg);

      const posLoc2 = gl.getAttribLocation(effectProg, "position");
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(posLoc2);
      gl.vertexAttribPointer(posLoc2, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fboTexture);
      gl.uniform1i(gl.getUniformLocation(effectProg, "uSource"), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glyphTexture);
      gl.uniform1i(gl.getUniformLocation(effectProg, "uGlyphs"), 1);

      gl.uniform2f(
        gl.getUniformLocation(effectProg, "uResolution"),
        displayW,
        displayH
      );
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uCellPixels"),
        CONFIG.effectScale * curDpr
      );
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uEffectAngle"),
        CONFIG.effectAngle
      );
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uEffectMix"),
        CONFIG.effectMix
      );
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uEffectInvert"),
        theme.effectInvert
      );
      gl.uniform1i(
        gl.getUniformLocation(effectProg, "uEffectColorMode"),
        CONFIG.effectColorMode
      );
      gl.uniform3fv(
        gl.getUniformLocation(effectProg, "uInk"),
        new Float32Array(CONFIG.effectInk)
      );
      gl.uniform3fv(gl.getUniformLocation(effectProg, "uPaper"), theme.paper);
      gl.uniform1f(gl.getUniformLocation(effectProg, "uSeed"), CONFIG.seed);
      gl.uniform1f(gl.getUniformLocation(effectProg, "uGrain"), CONFIG.grain);
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uGrainPixels"),
        CONFIG.grainSize * curDpr
      );

      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uGlyphColumns"),
        atlasInfo?.columns ?? 1
      );
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uGlyphAspect"),
        atlasInfo?.aspect ?? 1.3
      );
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uGlyphAvailable"),
        atlasInfo ? 1 : 0
      );

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(animId);
      gl.deleteBuffer(quadBuf);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(fboTexture);
      gl.deleteTexture(glyphTexture);
      gl.deleteProgram(patternProg);
      gl.deleteProgram(effectProg);
    };
  }, []);

  return (
    <canvas
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full select-none"
      ref={canvasRef}
    />
  );
};
