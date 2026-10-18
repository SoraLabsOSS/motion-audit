import assert from "node:assert/strict";
import test from "node:test";

import {
  combineFrameTiming,
  evaluateMeasuredFrameTiming,
  interpolateBlockingBudget,
  INP_CEILING_MS,
  LOAF_THRESHOLD_MS,
} from "../../src/math/frame-timing.ts";

test("Frame Timing Math: Blocking budget interpolates on published anchors only", () => {
  // No frame exceeded the LoAF line.
  assert.equal(interpolateBlockingBudget(0), 100);

  // Anchors are exact and traceable to the published thresholds.
  assert.equal(interpolateBlockingBudget(LOAF_THRESHOLD_MS), 90);
  assert.equal(interpolateBlockingBudget(INP_CEILING_MS), 50);

  // Monotonic and bounded across the whole range.
  let previous = 101;
  for (const ms of [0, 1, 10, 25, 50, 100, 150, 200, 300, 400, 1000, 5000]) {
    const score = interpolateBlockingBudget(ms);
    assert.ok(score <= previous, `score must not rise with blocking: ${ms}`);
    assert.ok(
      score >= 0 && score <= 100,
      `score out of range at ${ms}: ${score}`
    );
    previous = score;
  }

  // Far past the INP ceiling the measured result bottoms out at zero.
  assert.equal(interpolateBlockingBudget(400), 0);
});

test("Frame Timing Math: Unsupported measurement is never reported as clean", () => {
  for (const telemetry of [undefined, {}, { supported: false }]) {
    const result = evaluateMeasuredFrameTiming(telemetry);
    assert.equal(result.verdict, "unavailable");
    assert.equal(result.score, null);
    assert.equal(result.tier, null);
  }

  // Supported but nothing long ran is a real, positive measurement.
  const clean = evaluateMeasuredFrameTiming({
    entryCount: 0,
    maxDurationMs: 16,
    supported: true,
    totalBlockingDurationMs: 0,
  });
  assert.equal(clean.score, 100);
  assert.equal(clean.verdict, "clean");
  assert.equal(clean.tier, "S");
});

test("Frame Timing Math: Measured blocking maps to verdict and tier", () => {
  const run = (blockingMs: number) =>
    evaluateMeasuredFrameTiming({
      entryCount: 1,
      maxDurationMs: LOAF_THRESHOLD_MS + blockingMs,
      supported: true,
      totalBlockingDurationMs: blockingMs,
    });

  assert.equal(run(0).verdict, "clean");
  // Any blocking at all means a frame crossed the LoAF line, so it is never clean.
  assert.equal(run(1).verdict, "degraded");
  assert.equal(run(20).verdict, "degraded");
  assert.equal(run(120).verdict, "degraded");
  assert.equal(run(260).verdict, "poor");
  assert.equal(run(500).verdict, "poor");

  // Missing telemetry fields degrade to zero rather than NaN.
  const sparse = evaluateMeasuredFrameTiming({ supported: true });
  assert.equal(sparse.score, 100);
  assert.equal(sparse.totalBlockingMs, 0);
  assert.equal(sparse.maxFrameMs, 0);
});

test("Frame Timing Math: Worst viewport wins, unmeasured viewports are ignored", () => {
  const clean = evaluateMeasuredFrameTiming({
    entryCount: 0,
    supported: true,
    totalBlockingDurationMs: 0,
  });
  const blocked = evaluateMeasuredFrameTiming({
    entryCount: 4,
    maxDurationMs: 310,
    supported: true,
    totalBlockingDurationMs: 260,
  });
  const missing = evaluateMeasuredFrameTiming({ supported: false });

  const worst = combineFrameTiming(clean, blocked);
  assert.equal(worst.score, blocked.score);
  assert.equal(worst.verdict, "poor");
  assert.equal(worst.totalBlockingMs, 260);
  assert.equal(worst.maxFrameMs, 310);
  // Entry counts add across viewports.
  assert.equal(worst.loafEntryCount, 4);

  // A clean desktop must not mask a blocked mobile run.
  assert.ok((combineFrameTiming(clean, blocked).score ?? 100) < 100);

  // Partially unmeasured still reports what was measured.
  assert.equal(combineFrameTiming(clean, missing).score, 100);

  // Nothing measurable anywhere.
  assert.equal(combineFrameTiming(missing).verdict, "unavailable");
  assert.equal(combineFrameTiming().score, null);
});
