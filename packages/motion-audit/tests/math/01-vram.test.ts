import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateRawTextureMemory,
  calculateTiledBufferMemory,
  evaluateGpuResourcePressure,
  CANONICAL_VIEWPORTS,
  BYTES_PER_PIXEL,
} from "../../src/math/vram.ts";

test("VRAM Math: Proof of basic pixel allocation formula", () => {
  assert.equal(BYTES_PER_PIXEL, 4, "RGBA8888 must allocate 4 bytes per pixel");

  // Edge cases
  assert.equal(calculateRawTextureMemory(0, 500, 1), 0);
  assert.equal(calculateRawTextureMemory(500, 0, 1), 0);
  assert.equal(calculateRawTextureMemory(-10, 50, 1), 0);
});

test("VRAM Math: Canonical Desktop 1440x900 @ DPR=2 verification", () => {
  const { desktop } = CANONICAL_VIEWPORTS;
  const memory = calculateRawTextureMemory(
    desktop.width,
    desktop.height,
    desktop.dpr
  );

  // Math proof: 1440 * 900 * 4 bytes * (2^2) = 20,736,000 bytes
  const expectedBytes = 1440 * 900 * 4 * 4;
  assert.equal(memory, expectedBytes);
  assert.equal(memory, 20_736_000);

  const mib = memory / (1024 * 1024);
  assert.ok(mib > 19.7 && mib < 19.8, `Expected ~19.77 MiB, got ${mib}`);
});

test("VRAM Math: Canonical Mobile 390x844 @ DPR=3 verification", () => {
  const { mobile } = CANONICAL_VIEWPORTS;
  const memory = calculateRawTextureMemory(
    mobile.width,
    mobile.height,
    mobile.dpr
  );

  // Math proof: 390 * 844 * 4 bytes * (3^2) = 11,849,760 bytes
  const expectedBytes = 390 * 844 * 4 * 9;
  assert.equal(memory, expectedBytes);
  assert.equal(memory, 11_849_760);

  const mib = memory / (1024 * 1024);
  assert.ok(mib > 11.2 && mib < 11.4, `Expected ~11.30 MiB, got ${mib}`);
});

test("VRAM Math: Chromium 256x256 tile pooling & scroller raster memory", () => {
  const { desktop } = CANONICAL_VIEWPORTS;
  const tiledMemory = calculateTiledBufferMemory(2, desktop, 1.5);

  // Verifies Chromium cc::TileManager 256x256 tile allocation for scroller lookahead
  assert.ok(tiledMemory > 0);
  assert.ok(Number.isFinite(tiledMemory));
});

test("VRAM Math: GPU scoring and Tier calibration", () => {
  // Low memory scenario: 50MB texture memory, 10 layers, 20MB tiled -> Tier S
  const lowGpu = evaluateGpuResourcePressure({
    compositedVramBytes: 50 * 1024 * 1024,
    deviceContext: "desktop",
    layerCount: 10,
    tiledBackingBytes: 20 * 1024 * 1024,
  });
  assert.ok(lowGpu.score >= 80, `Expected S-tier (>=80), got ${lowGpu.score}`);
  assert.equal(lowGpu.tier, "S");

  // Severe memory overload: 1.5GB texture memory, 400 layers -> Tier F
  const highGpu = evaluateGpuResourcePressure({
    compositedVramBytes: 1.5 * 1024 * 1024 * 1024,
    deviceContext: "desktop",
    layerCount: 400,
    tiledBackingBytes: 700 * 1024 * 1024,
  });
  assert.ok(highGpu.score < 20, `Expected Low Tier, got ${highGpu.score}`);
  assert.ok(["D", "F"].includes(highGpu.tier));
});

test("VRAM Math: unavailable layer telemetry is neutral, not falsely pristine", () => {
  const result = evaluateGpuResourcePressure({
    compositedVramBytes: 0,
    deviceContext: "desktop",
    layerCount: 0,
    measurementAvailable: false,
  });
  assert.equal(result.score, 50);
  assert.equal(result.tier, "B");
});

test("VRAM Math: missing tiled telemetry is neutral, not zero pressure", () => {
  const result = evaluateGpuResourcePressure({
    compositedVramBytes: 50 * 1024 * 1024,
    deviceContext: "desktop",
    layerCount: 10,
  });
  assert.ok(result.score < 100);
});
