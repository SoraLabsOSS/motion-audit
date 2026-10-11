import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyPropertyCost,
  getMaxPropertyCost,
  calculatePaintAreaMultiplier,
  calculateDurationMultiplier,
  calculateAnimationDurationMultiplier,
  calculateScrollListenerPenalty,
  calculateScrollBehaviorPenalty,
  RAIL_INSTANT_RESPONSE_MS,
  BASELINE_PAINT_AREA_RATIO,
  MAX_SCROLL_CONTENTION_PENALTY,
  PIPELINE_COSTS,
  calculateOffscreenPenaltyMultiplier,
  OFFSCREEN_MUTATION_PENALTY_MULTIPLIER,
} from "../../src/math/scaling.ts";

test("Scaling Math: Property Cost Classification Vector", () => {
  // Compositor properties: 0 (Off-thread GPU execution)
  assert.equal(classifyPropertyCost("transform"), PIPELINE_COSTS.COMPOSITOR);
  assert.equal(classifyPropertyCost("opacity"), PIPELINE_COSTS.COMPOSITOR);
  assert.equal(classifyPropertyCost("scale"), PIPELINE_COSTS.COMPOSITOR);
  assert.equal(classifyPropertyCost("filter"), PIPELINE_COSTS.COMPOSITOR);

  // CSS variables: 15 (descendant style invalidation)
  assert.equal(
    classifyPropertyCost("--primary-color"),
    PIPELINE_COSTS.CSS_VARIABLE
  );
  assert.equal(
    classifyPropertyCost("--tab-indicator-width"),
    PIPELINE_COSTS.CSS_VARIABLE
  );
  assert.equal(
    classifyPropertyCost(" --accent-color "),
    PIPELINE_COSTS.CSS_VARIABLE
  );

  // Paint properties: 20 (main-thread rasterization pass)
  assert.equal(classifyPropertyCost("backgroundColor"), PIPELINE_COSTS.PAINT);
  assert.equal(classifyPropertyCost("box-shadow"), PIPELINE_COSTS.PAINT);
  assert.equal(classifyPropertyCost("borderRadius"), PIPELINE_COSTS.PAINT);

  // Layout properties: 50 (forced reflow & tree geometry)
  assert.equal(classifyPropertyCost("width"), PIPELINE_COSTS.LAYOUT);
  assert.equal(classifyPropertyCost("height"), PIPELINE_COSTS.LAYOUT);
  assert.equal(classifyPropertyCost("top"), PIPELINE_COSTS.LAYOUT);
  assert.equal(classifyPropertyCost("margin-left"), PIPELINE_COSTS.LAYOUT);

  // Max property cost takes the highest penalty in the array
  assert.equal(
    getMaxPropertyCost(["transform", "opacity"]),
    PIPELINE_COSTS.COMPOSITOR
  );
  assert.equal(
    getMaxPropertyCost(["transform", "backgroundColor"]),
    PIPELINE_COSTS.PAINT
  );
  assert.equal(
    getMaxPropertyCost(["transform", "backgroundColor", "width"]),
    PIPELINE_COSTS.LAYOUT
  );
});

test("Scaling Math: Paint Area Multiplier Clamping Laws", () => {
  // 1,000,000 px^2
  const viewportArea = 1_000_000;

  // Baseline reference point: exactly 10% viewport area -> multiplier = 1.0x
  const tenPercentArea = viewportArea * BASELINE_PAINT_AREA_RATIO;
  assert.equal(calculatePaintAreaMultiplier(tenPercentArea, viewportArea), 1);

  // Small paint: 2% viewport area (0.02 / 0.10 = 0.20 -> clamped to 0.25 floor)
  const twoPercentArea = viewportArea * 0.02;
  assert.equal(
    calculatePaintAreaMultiplier(twoPercentArea, viewportArea),
    0.25
  );

  // Moderate paint: 20% viewport area (0.20 / 0.10 = 2.0x)
  const twentyPercentArea = viewportArea * 0.2;
  assert.equal(
    calculatePaintAreaMultiplier(twentyPercentArea, viewportArea),
    2
  );

  // Huge paint: 50% viewport area (0.50 / 0.10 = 5.0x -> clamped to 4.0 ceiling)
  const fiftyPercentArea = viewportArea * 0.5;
  assert.equal(calculatePaintAreaMultiplier(fiftyPercentArea, viewportArea), 4);

  // Fullscreen paint: 100% viewport area -> ceiling clamped at 4.0
  assert.equal(calculatePaintAreaMultiplier(viewportArea, viewportArea), 4);
});

test("Scaling Math: Duration Discount Multiplier for Micro-interactions", () => {
  assert.equal(RAIL_INSTANT_RESPONSE_MS, 100);

  // Micro-interaction 50ms: 50 / 100 = 0.50x
  assert.equal(calculateDurationMultiplier(50), 0.5);

  // Ultra-fast transition 20ms: 20 / 100 = 0.20x -> clamped to floor 0.25x
  assert.equal(calculateDurationMultiplier(20), 0.25);

  // Exact reference threshold 100ms -> 1.0x
  assert.equal(calculateDurationMultiplier(100), 1);

  // Longer animations >= 100ms -> ceiling clamped at 1.0x
  assert.equal(calculateDurationMultiplier(150), 1);
  assert.equal(calculateDurationMultiplier(1200), 1);
});

test("Scaling Math: Repeated animation exposure is not discounted as a one-shot", () => {
  assert.equal(calculateAnimationDurationMultiplier(50, 1), 0.5);
  assert.equal(calculateAnimationDurationMultiplier(50, 3), 1);
  assert.equal(calculateAnimationDurationMultiplier(50, Infinity), 1);
});

test("Scaling Math: Scroll Listener Penalty Accumulation and Capping", () => {
  // 0 listeners: 0 cost
  assert.equal(calculateScrollListenerPenalty(0), 0);

  // 1 listener: 7 * log2(2) = 7 pts
  assert.equal(calculateScrollListenerPenalty(1), 7);

  // 2 listeners: 7 * log2(3) = 11.09 -> rounded 11 pts
  assert.equal(calculateScrollListenerPenalty(2), 11);

  // 5 listeners: 7 * log2(6) = 18.09 -> rounded 18 pts
  assert.equal(calculateScrollListenerPenalty(5), 18);

  // Large count (e.g. 50 listeners): capped at MAX_SCROLL_CONTENTION_PENALTY (30)
  assert.equal(
    calculateScrollListenerPenalty(50),
    MAX_SCROLL_CONTENTION_PENALTY
  );
});

test("Scaling Math: Scroll behavior penalties include blocking and layout work", () => {
  assert.equal(
    calculateScrollBehaviorPenalty({
      hasLayoutOnScroll: false,
      listenerCount: 1,
      nonPassiveCount: 0,
      unoptimizedCount: 0,
    }),
    7
  );
  assert.equal(
    calculateScrollBehaviorPenalty({
      hasLayoutOnScroll: true,
      listenerCount: 1,
      nonPassiveCount: 1,
      unoptimizedCount: 1,
    }),
    35
  );
});

test("Scaling Math: Offscreen Animation Penalty Multiplier", () => {
  assert.equal(OFFSCREEN_MUTATION_PENALTY_MULTIPLIER, 1.5);

  // Onscreen animations: never penalized (1.0x)
  assert.equal(
    calculateOffscreenPenaltyMultiplier(false, PIPELINE_COSTS.LAYOUT),
    1
  );
  assert.equal(
    calculateOffscreenPenaltyMultiplier(undefined, PIPELINE_COSTS.LAYOUT),
    1
  );

  // Offscreen compositor animations (transform/opacity): no extra penalty (1.0x, handled by GPU VRAM)
  assert.equal(
    calculateOffscreenPenaltyMultiplier(true, PIPELINE_COSTS.COMPOSITOR),
    1
  );
  assert.equal(calculateOffscreenPenaltyMultiplier(true, 0), 1);

  // Offscreen paint / layout animations: 1.5x penalty multiplier
  assert.equal(
    calculateOffscreenPenaltyMultiplier(true, PIPELINE_COSTS.PAINT),
    1.5
  );
  assert.equal(
    calculateOffscreenPenaltyMultiplier(true, PIPELINE_COSTS.LAYOUT),
    1.5
  );
  assert.equal(
    calculateOffscreenPenaltyMultiplier(true, PIPELINE_COSTS.CSS_VARIABLE),
    1.5
  );
});
