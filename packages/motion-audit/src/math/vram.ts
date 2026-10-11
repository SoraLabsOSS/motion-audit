/**
 * SoraLabs Motion Audit - VRAM & Texture Memory Pure Math Engine
 *
 * Grounded in:
 * - 32-bit RGBA8888 Color Model: 4 bytes per pixel allocation
 * - W3C CSS Values and Units Module: Physical pixel density DPR^2 scaling
 * - Chromium Compositor cc::TileManager 256x256 discrete tile pooling & raster lookahead
 * - Power-of-Two GPU Memory Pools (64MB, 128MB, 256MB, 512MB, 1024MB)
 * - Piecewise operational band interpolation (Google Lighthouse curve standard)
 */

import type { PerformanceTier } from "./scoring-engine.js";
import { tierFromScore } from "./scoring-engine.js";

// RGBA8888 standard pixel depth
export const BYTES_PER_PIXEL = 4;

export const CANONICAL_VIEWPORTS = {
  desktop: { dpr: 2, height: 900, width: 1440 },
  mobile: { dpr: 3, height: 844, width: 390 },
};

export const calculateRawTextureMemory = (
  width: number,
  height: number,
  dpr = 1
): number => {
  if (width <= 0 || height <= 0 || dpr <= 0) {
    return 0;
  }
  return Math.round(width * height * BYTES_PER_PIXEL * (dpr * dpr));
};

/**
 * Chromium cc::TileManager standard tile dimension (256x256 px).
 */
export const CHROMIUM_TILE_SIZE = 256;

/**
 * Calculates VRAM texture memory for a tiled layer based on Chromium cc::TileManager 256x256 tile pooling.
 */
export const calculateTiledLayerMemory = (
  layerWidth: number,
  layerHeight: number,
  dpr = 1
): number => {
  if (layerWidth <= 0 || layerHeight <= 0 || dpr <= 0) {
    return 0;
  }
  const physicalWidth = Math.ceil(layerWidth * dpr);
  const physicalHeight = Math.ceil(layerHeight * dpr);
  const tilesX = Math.ceil(physicalWidth / CHROMIUM_TILE_SIZE);
  const tilesY = Math.ceil(physicalHeight / CHROMIUM_TILE_SIZE);
  const tileBytes = CHROMIUM_TILE_SIZE * CHROMIUM_TILE_SIZE * BYTES_PER_PIXEL;
  return tilesX * tilesY * tileBytes;
};

/**
 * Estimates VRAM allocation for tiled scrollers considering Chromium's pre-raster margin
 * (cc::PictureLayerTiling raster horizon covering visible area plus pre-raster lookahead).
 */
export const calculateScrollerTiledMemory = (
  scrollerCount: number,
  viewport: { width: number; height: number; dpr: number },
  lookaheadFactor = 1.5
): number => {
  if (scrollerCount <= 0) {
    return 0;
  }
  const rasterHeight = Math.round(viewport.height * (1 + lookaheadFactor));
  const singleScrollerBytes = calculateTiledLayerMemory(
    viewport.width,
    rasterHeight,
    viewport.dpr
  );
  return scrollerCount * singleScrollerBytes;
};

// Canonical backwards-compatible alias
export const calculateTiledBufferMemory = calculateScrollerTiledMemory;

export interface MetricBandThresholds {
  S: number;
  A: number;
  B: number;
  C: number;
  D: number;
  F: number;
}

export interface GpuCalibrationThresholds {
  textureMemory: MetricBandThresholds;
  textureLayerCount: MetricBandThresholds;
  tiledMemory: MetricBandThresholds;
}

// Power-of-Two GPU Memory Budgets (Chromium cc::TileManager allocation pools)
export const DESKTOP_GPU_THRESHOLDS: GpuCalibrationThresholds = {
  textureLayerCount: { A: 40, B: 80, C: 160, D: 300, F: 500, S: 20 },
  textureMemory: {
    A: 128 * 1024 * 1024,
    B: 256 * 1024 * 1024,
    C: 512 * 1024 * 1024,
    D: 1024 * 1024 * 1024,
    F: 1536 * 1024 * 1024,
    S: 64 * 1024 * 1024,
  },
  tiledMemory: {
    A: 64 * 1024 * 1024,
    B: 128 * 1024 * 1024,
    C: 256 * 1024 * 1024,
    D: 512 * 1024 * 1024,
    F: 768 * 1024 * 1024,
    S: 32 * 1024 * 1024,
  },
};

export const MOBILE_GPU_THRESHOLDS: GpuCalibrationThresholds = {
  textureLayerCount: { A: 20, B: 40, C: 80, D: 150, F: 250, S: 10 },
  textureMemory: {
    A: 64 * 1024 * 1024,
    B: 128 * 1024 * 1024,
    C: 256 * 1024 * 1024,
    D: 512 * 1024 * 1024,
    F: 768 * 1024 * 1024,
    S: 32 * 1024 * 1024,
  },
  tiledMemory: {
    A: 48 * 1024 * 1024,
    B: 96 * 1024 * 1024,
    C: 192 * 1024 * 1024,
    D: 384 * 1024 * 1024,
    F: 512 * 1024 * 1024,
    S: 24 * 1024 * 1024,
  },
};

/**
 * Maps a continuous hardware metric into an operational performance score [0, 100]
 * using piecewise linear interpolation across calibrated resource bands (S -> F).
 */
export const interpolateOperationalBand = (
  value: number,
  bands: MetricBandThresholds
): number => {
  if (value <= 0) {
    return 100;
  }
  if (value <= bands.S) {
    // Tier S operational band: 90 - 100
    const ratio = value / bands.S;
    return Math.round(100 - ratio * 10);
  }
  if (value <= bands.A) {
    // Tier A operational band: 80 - 89
    const ratio = (value - bands.S) / (bands.A - bands.S);
    return Math.round(89 - ratio * 9);
  }
  if (value <= bands.B) {
    // Tier B operational band: 65 - 79
    const ratio = (value - bands.A) / (bands.B - bands.A);
    return Math.round(79 - ratio * 14);
  }
  if (value <= bands.C) {
    // Tier C operational band: 45 - 64
    const ratio = (value - bands.B) / (bands.C - bands.B);
    return Math.round(64 - ratio * 19);
  }
  if (value <= bands.D) {
    // Tier D operational band: 25 - 44
    const ratio = (value - bands.C) / (bands.D - bands.C);
    return Math.round(44 - ratio * 19);
  }
  if (value <= bands.F) {
    // Near-critical operational band: 5 - 24
    const ratio = (value - bands.D) / (bands.F - bands.D);
    return Math.max(5, Math.round(24 - ratio * 19));
  }
  // Exceeded critical ceiling
  return 0;
};

export interface GpuResourceBudgetMetrics {
  compositedVramBytes: number;
  layerCount: number;
  deviceContext: "desktop" | "mobile";
  tiledBackingBytes?: number;
  measurementAvailable?: boolean;
}

export interface GpuAuditEvaluation {
  score: number;
  tier: PerformanceTier;
}

/**
 * Evaluates GPU VRAM and compositor layer pressure against hardware memory pools.
 */
export const evaluateGpuResourcePressure = (
  metrics: GpuResourceBudgetMetrics
): GpuAuditEvaluation => {
  if (metrics.measurementAvailable === false) {
    return { score: 50, tier: "B" };
  }

  const t =
    metrics.deviceContext === "desktop"
      ? DESKTOP_GPU_THRESHOLDS
      : MOBILE_GPU_THRESHOLDS;

  const memoryScore = interpolateOperationalBand(
    metrics.compositedVramBytes,
    t.textureMemory
  );
  const layerScore = interpolateOperationalBand(
    metrics.layerCount,
    t.textureLayerCount
  );
  // Missing tiled telemetry is unknown, not zero pressure.
  const tiledScore =
    metrics.tiledBackingBytes === undefined
      ? 50
      : interpolateOperationalBand(metrics.tiledBackingBytes, t.tiledMemory);

  // Composite GPU score: 40% VRAM allocation, 40% layer complexity, 20% tiled scrollers
  const compositeScore = Math.round(
    0.4 * memoryScore + 0.4 * layerScore + 0.2 * tiledScore
  );
  const score = Math.max(0, Math.min(100, compositeScore));

  return { score, tier: tierFromScore(score) };
};
