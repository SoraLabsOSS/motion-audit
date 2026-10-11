import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePercentile,
  calculatePeakFrameConcurrency,
  calculateP75FrameConcurrency,
  computeEffectiveConcurrency,
} from "../../src/math/concurrency.ts";

test("Concurrency Math: Discrete Percentile Calculation", () => {
  // Empty values
  assert.equal(calculatePercentile([]), 0);

  // Simple distribution: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const p75 = calculatePercentile(sequence, 75);
  // P75 of 1..10 is approx 8
  assert.equal(p75, 8);

  const p50 = calculatePercentile(sequence, 50);
  // Median approximation
  assert.equal(p50, 6);
});

test("Concurrency Math: Heavy-Tailed Distribution P75 Resilience", () => {
  // Scenario: 100 frames total.
  // 90 frames have 1 active animation.
  // 9 frames have 2 active animations.
  // 1 single burst frame has 20 active animations (spike).
  const heavyTailed: number[] = [
    ...Array.from({ length: 90 }, () => 1),
    ...Array.from({ length: 9 }, () => 2),
    // Outlier spike
    20,
  ];

  const p75 = calculatePercentile(heavyTailed, 75);
  const max = Math.max(...heavyTailed);

  // P75 captures the sustained workload (1), filtering out the 20 spike!
  assert.equal(p75, 1);
  assert.equal(max, 20);
});

test("Concurrency Math: Frame active overlap mapping and P75 effective result", () => {
  // Construct 3 mock animations spanning different frames:
  // Anim A active on frames: [1, 2, 3, 4, 5]
  // Anim B active on frames: [3, 4, 5, 6, 7]
  // Anim C active on frames: [5, 6, 7, 8, 9]
  // Overlap on frame 5: all 3 active (concurrency = 3).
  // Overlap on frames 3, 4, 6, 7: 2 active.
  // Overlap on frames 1, 2, 8, 9: 1 active.
  const entries = [
    { frames: [1, 2, 3, 4, 5], id: "animA" },
    { frames: [3, 4, 5, 6, 7], id: "animB" },
    { frames: [5, 6, 7, 8, 9], id: "animC" },
  ];

  const max = calculatePeakFrameConcurrency(entries);
  assert.equal(max, 3, "Peak concurrent count on frame 5 should be 3");

  const p75 = calculateP75FrameConcurrency(entries);
  assert.ok(p75 >= 2 && p75 <= 3);

  const effectiveResult = computeEffectiveConcurrency(entries);
  assert.equal(effectiveResult.maxConcurrent, 3);
  assert.ok(
    effectiveResult.effectiveConcurrent >= 2 &&
      effectiveResult.effectiveConcurrent <= 3
  );
});

test("Concurrency Math: Empty and single-entry edge cases", () => {
  const emptyResult = computeEffectiveConcurrency([]);
  assert.deepEqual(emptyResult, {
    effectiveConcurrent: 0,
    maxConcurrent: 0,
    meanConcurrent: 0,
    p75Concurrent: 0,
  });

  const single = [{ frames: [1, 2, 3], id: "solo" }];
  const singleResult = computeEffectiveConcurrency(single);
  assert.equal(singleResult.maxConcurrent, 1);
  assert.equal(singleResult.effectiveConcurrent, 1);
});
