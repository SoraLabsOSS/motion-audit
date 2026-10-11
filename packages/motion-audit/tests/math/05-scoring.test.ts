import assert from "node:assert/strict";
import test from "node:test";

import {
  tierFromScore,
  averageTier,
  computeViewportScore,
  synthesizeOverallAudit,
  aggregateAnimationScores,
} from "../../src/math/scoring-engine.ts";

test("Scoring Math: Tier Conversion Boundaries", () => {
  // S: >= 80
  assert.equal(tierFromScore(100), "S");
  assert.equal(tierFromScore(85), "S");
  assert.equal(tierFromScore(80), "S");

  // A: 60 - 79
  assert.equal(tierFromScore(79), "A");
  assert.equal(tierFromScore(65), "A");
  assert.equal(tierFromScore(60), "A");

  // B: 40 - 59
  assert.equal(tierFromScore(59), "B");
  assert.equal(tierFromScore(40), "B");

  // C: 20 - 39
  assert.equal(tierFromScore(39), "C");
  assert.equal(tierFromScore(20), "C");

  // D: 10 - 19
  assert.equal(tierFromScore(19), "D");
  assert.equal(tierFromScore(10), "D");

  // F: < 10
  assert.equal(tierFromScore(9), "F");
  assert.equal(tierFromScore(0), "F");
  assert.equal(tierFromScore(-1), "F");
  assert.equal(tierFromScore(-50), "F");
});

test("Scoring Math: Average Tier Calculation", () => {
  assert.equal(averageTier(["S", "S"]), "S");
  // Index 0 + index 1 = 1 / 2 = 0.5 -> Math.round(0.5) = 1 -> 'A'
  assert.equal(averageTier(["S", "A"]), "A");
  // Index 0 + index 2 = 2 / 2 = 1 -> A
  assert.equal(averageTier(["S", "B"]), "A");
  // Index 1 + index 5 = 6 / 2 = 3 -> C
  assert.equal(averageTier(["A", "F"]), "C");
});

test("Scoring Math: 4-Pillar Viewport Weighted Aggregation & Pipeline Bottleneck Coupling", () => {
  // Scenario 1: Pristine site
  // Animations: 100, Scroll: 100, Thrashing: 100, GPU: 95
  const pristineResult = computeViewportScore({
    animations: { score: 100, tier: "S" },
    gpuPressure: { score: 95, tier: "S" },
    scrollAnimations: { score: 100, tier: "S" },
    thrashing: { score: 100, tier: "S" },
  });
  assert.ok(pristineResult.score >= 98);
  assert.equal(pristineResult.tier, "S");

  // Scenario 2: Severe Layout Thrashing
  // Animations: 80, Scroll: 75, Thrashing: 10 (catastrophic thrash), GPU: 85
  const thrashingSite = computeViewportScore({
    animations: { score: 80, tier: "S" },
    gpuPressure: { score: 85, tier: "S" },
    scrollAnimations: { score: 75, tier: "A" },
    thrashing: { score: 10, tier: "D" },
  });
  // Thrashing heavily pulls down score
  assert.ok(thrashingSite.score <= 65);
  assert.ok(["A", "B"].includes(thrashingSite.tier));

  // Scenario 3: 4-Pillar Balanced Convex Combination
  // Animations: 50 (35%), Scroll: 50 (25%), Thrashing: 50 (25%), GPU: 90 (15%)
  // Weighted final = 50*0.85 + 90*0.15 = 42.5 + 13.5 = 56.
  const balancedResult = computeViewportScore({
    animations: { score: 50, tier: "B" },
    gpuPressure: { score: 90, tier: "S" },
    scrollAnimations: { score: 50, tier: "B" },
    thrashing: { score: 50, tier: "B" },
  });
  assert.equal(
    balancedResult.score,
    56,
    "Should calculate pure normalized 4-pillar convex combination"
  );
  assert.equal(balancedResult.tier, "B");
});

test("Scoring Math: Overall Audit Synthesis (Desktop + Mobile)", () => {
  const synthesis = synthesizeOverallAudit(90, 80, "S", "S");
  assert.equal(synthesis.overallScore, 85);
  assert.equal(synthesis.overallTier, "S");

  const mixedSynthesis = synthesizeOverallAudit(85, 55, "S", "B");
  assert.equal(mixedSynthesis.overallScore, 70);
  assert.equal(mixedSynthesis.overallTier, "A");
});

test("Scoring Math: aggregateAnimationScores avoids arithmetic mean dilution", () => {
  // Case 1: Empty input defaults to 100 / Tier S
  assert.deepEqual(aggregateAnimationScores([]), { score: 100, tier: "S" });

  // Case 2: All pristine animations (all 100) -> 100 / Tier S
  assert.deepEqual(aggregateAnimationScores([100, 100, 100]), {
    score: 100,
    tier: "S",
  });

  // Case 3: 1 catastrophic layout reflow (score 10) + 9 pristine GPU animations (score 100)
  // Arithmetic mean would be: (900 + 10) / 10 = 91 (Tier S - FALSE POSITIVE)
  // Bottleneck coupling: worst=10 (30%), mean=91 (70%) -> 3 + 63.7 = 67 (Tier A)
  const coupled = aggregateAnimationScores([
    100, 100, 100, 100, 100, 100, 100, 100, 100, 10,
  ]);
  assert.ok(
    coupled.score <= 70,
    `Score should drop below Tier S due to critical bottleneck, got ${coupled.score}`
  );
  assert.equal(coupled.tier, "B");

  // Case 3b: Multiple catastrophic failures ([10, 10, 10, 100, 100]) cap at Tier C (35 pts)
  const multiFailure = aggregateAnimationScores([10, 10, 10, 100, 100]);
  assert.ok(multiFailure.score <= 59);
  assert.equal(multiFailure.tier, "C");

  // Case 4: Moderate homogenous animations (all 60)
  const moderate = aggregateAnimationScores([60, 60, 60]);
  assert.equal(moderate.score, 60);
  assert.equal(moderate.tier, "A");
});

test("Scoring Math: computeViewportScore enforces bottleneck ceiling on critical failure", () => {
  // A site with a critical thrashing failure (< 20) cannot exceed Tier B (score <= 59)
  const criticalSite = computeViewportScore({
    animations: { score: 100, tier: "S" },
    gpuPressure: { score: 100, tier: "S" },
    scrollAnimations: { score: 100, tier: "S" },
    // Critical failure
    thrashing: { score: 0, tier: "D" },
  });

  assert.ok(
    criticalSite.score <= 59,
    `Critical site must be capped at 59, got ${criticalSite.score}`
  );
  assert.ok(["B", "C", "D", "F"].includes(criticalSite.tier));
});
