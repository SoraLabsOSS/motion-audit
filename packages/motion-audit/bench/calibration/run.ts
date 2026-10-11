import {
  getMaxPropertyCost,
  calculateAnimationDurationMultiplier,
  calculatePaintAreaMultiplier,
} from "../../src/math/scaling.js";
import type { PerformanceTier } from "../../src/math/scoring-engine.js";
import {
  computeViewportScore,
  tierFromScore,
} from "../../src/math/scoring-engine.js";
import type { ThrashViolation } from "../../src/math/thrashing-graph.js";
import { analyzeLayoutThrashing } from "../../src/math/thrashing-graph.js";
import { evaluateGpuResourcePressure } from "../../src/math/vram.js";

export interface ObservableBrowserTelemetry {
  testedProperties: string[];
  activeViolations: ThrashViolation[];
  gpuMemoryBytes: number;
  layerCount: number;
  tiledBackingBytes: number;
  durationMs: number;
  viewportArea: number;
  paintArea: number;
}

export interface CalibrationFixture {
  name: string;
  observableTelemetry: ObservableBrowserTelemetry;
  expectedBounds: {
    minScore: number;
    maxScore: number;
    expectedTier: PerformanceTier;
  };
}

export const FIXTURES: CalibrationFixture[] = [
  {
    expectedBounds: { expectedTier: "S", maxScore: 100, minScore: 90 },
    name: "Fixture A: Clean Compositor Stagger",
    observableTelemetry: {
      activeViolations: [],
      durationMs: 300,
      gpuMemoryBytes: 45 * 1024 * 1024,
      layerCount: 15,
      paintArea: 144 * 90,
      testedProperties: ["transform", "opacity"],
      tiledBackingBytes: 16 * 1024 * 1024,
      viewportArea: 1440 * 900,
    },
  },
  {
    expectedBounds: { expectedTier: "D", maxScore: 30, minScore: 0 },
    name: "Fixture B: Forced Reflow Loop in rAF",
    observableTelemetry: {
      activeViolations: Array.from({ length: 30 }, (_, i) => ({
        api: "offsetHeight",
        frame: Math.floor(i / 2) + 1,
        readSelector: "#root > .box",
        type: "layout" as const,
        writeSelector: "#root > .box",
      })),
      durationMs: 500,
      gpuMemoryBytes: 30 * 1024 * 1024,
      layerCount: 5,
      paintArea: 800 * 600,
      testedProperties: ["width", "height"],
      tiledBackingBytes: 8 * 1024 * 1024,
      viewportArea: 1440 * 900,
    },
  },
  {
    expectedBounds: { expectedTier: "S", maxScore: 100, minScore: 80 },
    name: "Fixture C: SSR Hydration Batch Reads",
    observableTelemetry: {
      activeViolations: Array.from({ length: 12 }, (_, i) => ({
        api: "getBoundingClientRect",
        frame: 0,
        phase: "init",
        readSelector: `.card-${i}`,
        type: "layout" as const,
        writeSelector: `.card-${i}`,
      })),
      durationMs: 150,
      gpuMemoryBytes: 50 * 1024 * 1024,
      layerCount: 12,
      paintArea: 300 * 300,
      testedProperties: ["background-color"],
      tiledBackingBytes: 32 * 1024 * 1024,
      viewportArea: 1440 * 900,
    },
  },
  {
    expectedBounds: { expectedTier: "B", maxScore: 75, minScore: 50 },
    name: "Fixture D: Unbounded Texture Allocation",
    observableTelemetry: {
      activeViolations: [],
      durationMs: 300,
      gpuMemoryBytes: 1600 * 1024 * 1024,
      layerCount: 550,
      paintArea: 1440 * 900,
      testedProperties: ["transform"],
      tiledBackingBytes: 1024 * 1024 * 1024,
      viewportArea: 1440 * 900,
    },
  },
];

export const runCalibration = (): boolean => {
  console.log(
    "=== SoraLabs Benchmark & Validation Suite: Calibration Matrix ===\n"
  );
  let passCount = 0;

  for (const f of FIXTURES) {
    const t = f.observableTelemetry;
    const thrashing = analyzeLayoutThrashing(t.activeViolations);
    const gpu = evaluateGpuResourcePressure({
      compositedVramBytes: t.gpuMemoryBytes,
      deviceContext: "desktop",
      layerCount: t.layerCount,
      tiledBackingBytes: t.tiledBackingBytes,
    });

    const cost = getMaxPropertyCost(t.testedProperties);
    const area = calculatePaintAreaMultiplier(t.paintArea, t.viewportArea);
    const dur = calculateAnimationDurationMultiplier(t.durationMs);
    const animScore = Math.max(0, Math.round(100 - cost * area * dur));

    const result = computeViewportScore({
      animations: { score: animScore, tier: tierFromScore(animScore) },
      gpuPressure: { score: gpu.score, tier: gpu.tier },
      thrashing: {
        score: thrashing.score,
        tier: tierFromScore(thrashing.score),
      },
    });

    const passed =
      result.score >= f.expectedBounds.minScore &&
      result.score <= f.expectedBounds.maxScore &&
      result.tier === f.expectedBounds.expectedTier;

    if (passed) {
      passCount += 1;
    }
    console.log(`[${passed ? "PASS" : "FAIL"}] ${f.name}`);
    console.log(
      `       Pillars: Anim=${animScore} | Thrash=${thrashing.score} | GPU=${gpu.score}`
    );
    console.log(
      `       Synthesis: ${result.score} (Tier ${result.tier}) | Expected: [${f.expectedBounds.minScore}..${f.expectedBounds.maxScore}] Tier ${f.expectedBounds.expectedTier}\n`
    );
  }

  console.log(
    `Calibration Result: ${passCount}/${FIXTURES.length} fixtures calibrated.`
  );
  return passCount === FIXTURES.length;
};

if (!runCalibration()) {
  process.exitCode = 1;
}
