import assert from "node:assert/strict";
import test from "node:test";

import {
  computeMaxConsecutiveRun,
  analyzeLayoutThrashing,
  MIN_CONSECUTIVE_REFLOW_FRAMES,
} from "../../src/math/thrashing-graph.ts";
import type { ThrashViolation } from "../../src/math/thrashing-graph.ts";

test("Cumulative Reflow Math: Consecutive Run Calculation", () => {
  // Empty
  assert.equal(computeMaxConsecutiveRun([]), 0);

  // Scattered non-consecutive frames: [1, 3, 5, 7, 9] -> max run = 1
  assert.equal(computeMaxConsecutiveRun([1, 3, 5, 7, 9]), 1);

  // Consecutive run of 4 frames: [2, 3, 4, 5, 8, 10] -> max run = 4
  assert.equal(computeMaxConsecutiveRun([2, 3, 4, 5, 8, 10]), 4);

  // Unsorted array with duplicates: [5, 2, 3, 4, 3, 2] -> max run = 4 (2..5)
  assert.equal(computeMaxConsecutiveRun([5, 2, 3, 4, 3, 2]), 4);

  // Full 10 frame continuous run
  const tenFrames = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(computeMaxConsecutiveRun(tenFrames), 10);
});

test("Cumulative Reflow Math: Empty violations baseline", () => {
  const result = analyzeLayoutThrashing([]);
  assert.deepEqual(result, {
    affectedSelectors: [],
    maxConsecutiveFrames: 0,
    reflowCount: 0,
    score: 100,
    totalPenalty: 0,
    violationFrames: 0,
  });
});

test("Cumulative Reflow Math: Style vs Layout base cost differentiation", () => {
  const styleViolation: ThrashViolation[] = [
    {
      api: "getComputedStyle",
      frame: 1,
      readSelector: ".card",
      type: "style",
      writeSelector: ".card",
    },
  ];

  const layoutViolation: ThrashViolation[] = [
    {
      api: "offsetHeight",
      frame: 1,
      readSelector: ".card",
      type: "layout",
      writeSelector: ".card",
    },
  ];

  const styleResult = analyzeLayoutThrashing(styleViolation);
  const layoutResult = analyzeLayoutThrashing(layoutViolation);

  // Layout reflow penalty is higher than style recalculation
  assert.ok(layoutResult.totalPenalty > styleResult.totalPenalty);
  assert.ok(layoutResult.score < styleResult.score);
});

test("Cumulative Reflow Math: Invalidation scope penalty for root document mutations", () => {
  const leafMutation: ThrashViolation[] = [
    {
      api: "offsetWidth",
      frame: 1,
      readSelector: ".widget-item",
      type: "layout",
      writeSelector: ".widget-item",
    },
  ];

  const rootMutation: ThrashViolation[] = [
    {
      api: "offsetWidth",
      frame: 1,
      readSelector: "body > #root",
      type: "layout",
      writeSelector: "body > #root",
    },
  ];

  const leafResult = analyzeLayoutThrashing(leafMutation);
  const rootResult = analyzeLayoutThrashing(rootMutation);

  // Root mutation causes full render tree invalidation (1.5x scope multiplier)
  assert.ok(rootResult.totalPenalty > leafResult.totalPenalty);
});

test("Cumulative Reflow Math: Intra-frame repeated reflows (N+1 query loop detection)", () => {
  // Single reflow in frame 1
  const single = [
    {
      api: "offsetHeight",
      frame: 1,
      readSelector: ".item",
      type: "layout" as const,
      writeSelector: ".item",
    },
  ];

  // 3 reflows in the same frame 1 (intra-frame loop anti-pattern)
  const loop = [
    {
      api: "offsetHeight",
      frame: 1,
      readSelector: ".item",
      type: "layout" as const,
      writeSelector: ".item",
    },
    {
      api: "offsetHeight",
      frame: 1,
      readSelector: ".item",
      type: "layout" as const,
      writeSelector: ".item",
    },
    {
      api: "offsetHeight",
      frame: 1,
      readSelector: ".item",
      type: "layout" as const,
      writeSelector: ".item",
    },
  ];

  const singleResult = analyzeLayoutThrashing(single);
  const loopResult = analyzeLayoutThrashing(loop);

  // Compounded intra-frame multiplier penalizes the N+1 loop heavily
  assert.ok(loopResult.totalPenalty > singleResult.totalPenalty * 2);
  assert.equal(loopResult.reflowCount, 3);
  assert.equal(loopResult.violationFrames, 1);
});

test("Cumulative Reflow Math: Sustained animation jank across consecutive frames", () => {
  // 8 consecutive frames with layout thrashing saturates the sustained jank multiplier
  const consecutiveViolations: ThrashViolation[] = Array.from(
    { length: 8 },
    (_, i) => ({
      api: "offsetHeight",
      frame: i + 1,
      readSelector: ".scroller",
      type: "layout",
      writeSelector: ".scroller",
    })
  );

  const result = analyzeLayoutThrashing(consecutiveViolations);
  assert.equal(result.maxConsecutiveFrames, 8);
  assert.equal(result.violationFrames, 8);
  assert.equal(result.reflowCount, 8);
  assert.equal(
    result.score,
    0,
    "8 consecutive reflow frames should exhaust frame budget (score = 0)"
  );
});

test("Cumulative Reflow Math: Isolated reflow is discounted, sustained burst is not", () => {
  const at = (frame: number): ThrashViolation => ({
    api: "offsetHeight",
    frame,
    readSelector: ".item",
    type: "layout",
    writeSelector: ".item",
  });

  // One isolated reflow is charged at a discount, never waived to zero.
  const isolated = analyzeLayoutThrashing([at(1)]);
  assert.ok(
    isolated.totalPenalty > 0,
    "isolated reflow must still carry a cost"
  );
  assert.equal(isolated.maxConsecutiveFrames, 1);

  // A burst across consecutive frames is charged in full and scores worse.
  const sustained = analyzeLayoutThrashing([1, 2, 3, 4, 5, 6, 7, 8].map(at));
  assert.ok(sustained.maxConsecutiveFrames >= MIN_CONSECUTIVE_REFLOW_FRAMES);
  assert.ok(
    sustained.totalPenalty > isolated.totalPenalty,
    `sustained ${sustained.totalPenalty} must exceed isolated ${isolated.totalPenalty}`
  );

  // The discount must actually reduce cost: three isolated reflows on
  // non-consecutive frames cost less than three on consecutive frames.
  const scattered = analyzeLayoutThrashing([1, 40, 90].map(at));
  const contiguous = analyzeLayoutThrashing([1, 2, 3].map(at));
  assert.ok(scattered.totalPenalty < contiguous.totalPenalty);
});

test("Cumulative Reflow Math: Intra-frame N+1 loop is still detected", () => {
  // Three forced reflows inside ONE frame is the classic query-loop anti-pattern.
  // Gating on consecutive frames would have silently dropped it.
  const oneFrameLoop = analyzeLayoutThrashing(
    [1, 1, 1].map(() => ({
      api: "offsetHeight",
      frame: 1,
      readSelector: ".item",
      type: "layout" as const,
      writeSelector: ".item",
    }))
  );
  const single = analyzeLayoutThrashing([
    {
      api: "offsetHeight",
      frame: 1,
      readSelector: ".item",
      type: "layout",
      writeSelector: ".item",
    },
  ]);
  assert.ok(
    oneFrameLoop.totalPenalty > single.totalPenalty,
    `intra-frame loop ${oneFrameLoop.totalPenalty} must exceed single ${single.totalPenalty}`
  );
});
