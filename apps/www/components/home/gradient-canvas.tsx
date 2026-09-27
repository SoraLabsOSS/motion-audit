"use client";

import { useEffect, useRef } from "react";

const COLORS_FLAT = new Float32Array([
  6 / 255,
  3 / 255,
  18 / 255,
  32 / 255,
  10 / 255,
  72 / 255,
  92 / 255,
  24 / 255,
  128 / 255,
  170 / 255,
  42 / 255,
  114 / 255,
  42 / 255,
  165 / 255,
  160 / 255,
  135 / 255,
  145 / 255,
  195 / 255,
]);

const CONFIG = {
  brightness: -0.12,
  contrast: 1.15,
  direction: 0,
  effectLevels: 5,
  effectMix: 1,
  effectScale: 8,
  fieldFrequency: 0.62,
  fieldOctaves: 4,
  grain: 0.05,
  grainSize: 1.2,
  noiseAmount: 0.03,
  noiseFrequency: 0.9,
  noiseOctaves: 3,
  patternCenterX: -0.1,
  patternCenterY: 0.05,
  patternDensity: 3,
  scale: 1,
  seed: 2077,
  softness: 0.75,
  speed: 0.05,
  warp: 1.25,
  warpFrequency: 1,
  wave: 1,
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
  uniform int uFieldOctaves;
  uniform int uNoiseOctaves;
  uniform int uColorCount;
  uniform vec3 uColors[6];

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

  vec2 patternCenter() {
    return uPatternCenter * uScale;
  }

  float patternField(vec2 p, vec2 warped, vec2 q, vec2 r, float terrain, float phase) {
    vec2 offset = warped - patternCenter();
    float angle = atan(offset.y, offset.x);
    float twist = length(offset) * uWarp * 1.6;
    float arms = max(1.0, floor(uPatternDensity + 0.5));
    float sweep = 0.5 + 0.5 * sin(angle * arms + twist + terrain * 0.9);
    float ridge = ridgeShape(angle * arms + twist * 1.4 + r.x * 1.5);
    float broad = terrain * 0.22 + q.x * 0.12;
    float field = 0.5 + broad + (sweep - 0.5) * 0.55 + (ridge - 0.28) * uWave * 0.26;
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
    // Soft center falloff to guarantee hero text contrast
    vec2 centerUv = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    float centerDist = length(centerUv);
    float centerVignette = smoothstep(0.12, 0.85, centerDist);
    color *= mix(0.68, 1.0, centerVignette);

    float dither = (grainHash(gl_FragCoord.xy + 17.0) - 0.5) / 255.0;
    color += dither;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

const EFFECT_FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 vUv;
  uniform sampler2D uSource;
  uniform float uCellPixels;
  uniform float uEffectMix;
  uniform int uEffectLevels;
  uniform float uSeed;
  uniform float uGrain;
  uniform float uGrainPixels;

  float grainHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }

  float cellPixels() {
    return max(1.0, uCellPixels);
  }

  float bayer2(vec2 position) {
    position = floor(position);
    return fract(position.x / 2.0 + position.y * position.y * 0.75);
  }

  float bayer4(vec2 position) {
    return bayer2(position * 0.5) * 0.25 + bayer2(position);
  }

  float bayer8(vec2 position) {
    return bayer4(position * 0.5) * 0.25 + bayer2(position);
  }

  vec3 applyEffect(vec3 source) {
    vec2 position = gl_FragCoord.xy / max(1.0, cellPixels() * 0.25);
    float threshold = bayer8(position);
    float steps = max(2.0, float(uEffectLevels)) - 1.0;
    return floor(source * steps + threshold) / steps;
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

export const GradientCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

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

    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

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
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
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

      // PASS 1: Procedural Gradient to FBO
      gl.activeTexture(gl.TEXTURE0);
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
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uContrast"),
        CONFIG.contrast
      );
      gl.uniform1f(
        gl.getUniformLocation(patternProg, "uBrightness"),
        CONFIG.brightness
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
        gl.getUniformLocation(patternProg, "uFieldOctaves"),
        CONFIG.fieldOctaves
      );
      gl.uniform1i(
        gl.getUniformLocation(patternProg, "uNoiseOctaves"),
        CONFIG.noiseOctaves
      );
      gl.uniform1i(gl.getUniformLocation(patternProg, "uColorCount"), 6);
      gl.uniform3fv(gl.getUniformLocation(patternProg, "uColors"), COLORS_FLAT);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // PASS 2: Dither Effect to Screen
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

      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uCellPixels"),
        CONFIG.effectScale * curDpr
      );
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uEffectMix"),
        CONFIG.effectMix
      );
      gl.uniform1i(
        gl.getUniformLocation(effectProg, "uEffectLevels"),
        CONFIG.effectLevels
      );
      gl.uniform1f(gl.getUniformLocation(effectProg, "uSeed"), CONFIG.seed);
      gl.uniform1f(gl.getUniformLocation(effectProg, "uGrain"), CONFIG.grain);
      gl.uniform1f(
        gl.getUniformLocation(effectProg, "uGrainPixels"),
        CONFIG.grainSize * curDpr
      );

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      gl.deleteBuffer(quadBuf);
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(fboTexture);
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
