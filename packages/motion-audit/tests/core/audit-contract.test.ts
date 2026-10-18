import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { generateAuditFindings } from "../../src/diagnostics/findings.js";
import {
  combineFrameTiming,
  evaluateMeasuredFrameTiming,
} from "../../src/math/frame-timing.js";
import {
  synthesizeOverallAudit,
  computeViewportScore,
  tierFromScore,
  averageTier,
} from "../../src/math/scoring-engine.js";
import type { ViewportAuditResult } from "../../src/types.js";

const createMockViewport = (
  overallScore: number,
  blockingMs = 0
): ViewportAuditResult => ({
  animations: [],
  animationsScore: overallScore,
  animationsTier: tierFromScore(overallScore),
  frameTiming: evaluateMeasuredFrameTiming({
    entryCount: blockingMs > 0 ? 2 : 0,
    maxDurationMs: 50 + blockingMs,
    supported: true,
    totalBlockingDurationMs: blockingMs,
  }),
  gpuScore: overallScore,
  gpuTier: tierFromScore(overallScore),
  layerCount: 8,
  layers: [],
  overallScore,
  overallTier: tierFromScore(overallScore),
  scroll: {
    hasLayoutOnScroll: false,
    listenerCount: 0,
    selectors: [],
    usesPassive: true,
    usesRafOrDebounce: true,
  },
  scrollScore: overallScore,
  scrollTier: tierFromScore(overallScore),
  thrashingScore: overallScore,
  thrashingTier: tierFromScore(overallScore),
  viewport: { dpr: 2, height: 900, label: "desktop", width: 1440 },
  vramBytes: 40_000_000,
});

describe("Audit Contract & Report Synthesis", () => {
  test("synthesizes desktop and mobile scores into overall grade", () => {
    // Tier S
    const desktop = createMockViewport(90);
    // Tier A
    const mobile = createMockViewport(70);

    const synthesized = synthesizeOverallAudit(
      desktop.overallScore,
      mobile.overallScore
    );

    assert.equal(synthesized.overallScore, 80);
    assert.equal(synthesized.overallTier, "S");
  });

  test("averageTier rounds and handles boundary cases", () => {
    assert.equal(averageTier(["S", "S"]), "S");
    // indices 0 and 1 -> avg 0.5 -> 1 -> Tier A
    assert.equal(averageTier(["S", "A"]), "A");
    assert.equal(averageTier(["D", "F"]), "F");
    assert.equal(averageTier(["F", "F"]), "F");
  });

  test("computeViewportScore weights all 4 pillars cleanly", () => {
    // Non-GPU pillars average 30, GPU is 100
    const result = computeViewportScore({
      animations: { score: 30, tier: "C" },
      gpuPressure: { score: 100, tier: "S" },
      scrollAnimations: { score: 30, tier: "C" },
      thrashing: { score: 30, tier: "C" },
    });

    // Weighted avg: 30*0.85 + 100*0.15 = 25.5 + 15 = 40.5 -> 41 (Tier B)
    assert.equal(result.score, 41);
    assert.equal(result.tier, "B");
  });

  test("generateAuditFindings returns empty array for pristine viewports", () => {
    const desktop = createMockViewport(100);
    const mobile = createMockViewport(100);
    const findings = generateAuditFindings(
      "https://pristine.com",
      desktop,
      mobile
    );

    assert.equal(findings.length, 0);
  });
});

describe("Measured frame timing as the primary report result", () => {
  test("is independent of the model score", () => {
    // A page can carry a healthy model grade while measurably blocking frames,
    // because the model infers from static attributes and cannot see frame cost.
    const modelLooksGreat = createMockViewport(95);
    const modelLooksGreatBlocked = createMockViewport(95, 260);

    assert.equal(modelLooksGreat.frameTiming?.verdict, "clean");
    assert.equal(modelLooksGreatBlocked.frameTiming?.verdict, "poor");
    // Same model score, opposite measured reality.
    assert.equal(
      modelLooksGreatBlocked.overallScore,
      modelLooksGreat.overallScore
    );
  });

  test("report-level timing takes the worst viewport", () => {
    const combined = combineFrameTiming(
      createMockViewport(90, 0).frameTiming,
      createMockViewport(90, 180).frameTiming
    );
    assert.equal(combined.verdict, "degraded");
    assert.equal(combined.totalBlockingMs, 180);
  });
});
