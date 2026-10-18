/**
 * SoraLabs Motion Audit - Measured Frame Timing Engine
 *
 * This is the only module in the codebase that reports a *measured* result.
 * Every other pillar (animations, scroll, thrashing, GPU) scores the audit's own
 * inferred model of the page. This one scores numbers the browser recorded itself
 * via the Long Animation Frames API, so its anchors are published thresholds
 * rather than project-chosen calibration values.
 *
 * Grounded in:
 * - W3C Long Animation Frames: a rendering update is a "long animation frame"
 *   once it exceeds 50ms. `blockingDuration` is defined as the sum of each
 *   qualifying task's duration minus that 50ms threshold, including the final
 *   render update. It is therefore already expressed as milliseconds spent past
 *   the line, not as a count.
 * - Web Vitals Interaction to Next Paint: <= 200ms at p75 is "good".
 * - 60Hz display frame budget: 16.6ms of main-thread time per frame.
 *
 * Because the input is milliseconds-over-threshold rather than an inferred cost,
 * the interpolation below has no free parameters beyond the two band anchors.
 */

import type { PerformanceTier } from "./scoring-engine.js";
import { tierFromScore } from "./scoring-engine.js";

/** Main-thread time available per frame at 60Hz. */
export const FRAME_BUDGET_MS = 16.6;

/** W3C Long Animation Frames threshold: a frame longer than this is "long". */
export const LOAF_THRESHOLD_MS = 50;

/** Web Vitals INP "good" ceiling at p75. */
export const INP_CEILING_MS = 200;

export type FrameTimingVerdict = "clean" | "degraded" | "poor" | "unavailable";

export interface MeasuredFrameTelemetry {
  entryCount?: number;
  maxDurationMs?: number;
  supported?: boolean;
  totalBlockingDurationMs?: number;
  totalDurationMs?: number;
  /** Blocking during the interaction (scroll) phase. Preferred scoring input. */
  interactionBlockingMs?: number;
  loadBlockingMs?: number;
}

export interface MeasuredFrameTiming {
  /** Long animation frames the browser reported during the run. */
  loafEntryCount: number;
  /** Blocking during the interaction phase. This drives the score. */
  scrollBlockingMs: number;
  /** Blocking before the interaction phase, i.e. page load. Not motion. */
  loadBlockingMs: number;
  /** Blocking across the whole run. Reported for transparency. */
  totalBlockingMs: number;
  /** Longest single frame observed, in milliseconds. Not scored: it varies
   *  far more between runs than the blocking total. */
  maxFrameMs: number;
  /** Score in [0, 100], or null when the browser cannot measure this. */
  score: number | null;
  tier: PerformanceTier | null;
  verdict: FrameTimingVerdict;
}

/**
 * Maps measured blocking time onto [0, 100], anchored on the two published
 * thresholds rather than on project-chosen band edges.
 */
export const interpolateBlockingBudget = (blockingMs: number): number => {
  if (blockingMs <= 0) {
    return 100;
  }
  // Nothing exceeded the LoAF line by more than one threshold's worth.
  if (blockingMs <= LOAF_THRESHOLD_MS) {
    return Math.round(100 - (blockingMs / LOAF_THRESHOLD_MS) * 10);
  }
  // Sustained blocking, still inside the range INP considers "good".
  if (blockingMs <= INP_CEILING_MS) {
    const ratio =
      (blockingMs - LOAF_THRESHOLD_MS) / (INP_CEILING_MS - LOAF_THRESHOLD_MS);
    return Math.round(89 - ratio * 39);
  }
  // Past the INP "good" ceiling: responsiveness is measurably impaired.
  return Math.max(
    0,
    Math.round(50 - ((blockingMs - INP_CEILING_MS) / INP_CEILING_MS) * 50)
  );
};

/**
 * Verdict follows the LoAF definition rather than a score cut: any millisecond of
 * blocking means at least one frame exceeded the 50ms threshold, which the spec
 * calls a long animation frame. A page that produced one is not clean, however
 * little time it cost.
 */
const verdictFromBlocking = (
  blockingMs: number,
  score: number
): FrameTimingVerdict => {
  if (blockingMs <= 0) {
    return "clean";
  }
  return score >= 50 ? "degraded" : "poor";
};

/**
 * Evaluates the measured blocking budget for one viewport run.
 *
 * An unsupported browser yields `verdict: "unavailable"` and a null score. This
 * is deliberately not treated as a clean run: an unmeasured dimension is unknown,
 * not healthy.
 */
export const evaluateMeasuredFrameTiming = (
  telemetry?: MeasuredFrameTelemetry
): MeasuredFrameTiming => {
  const totalBlockingMs = Math.max(0, telemetry?.totalBlockingDurationMs ?? 0);
  const maxFrameMs = Math.max(0, telemetry?.maxDurationMs ?? 0);
  const loafEntryCount = Math.max(0, telemetry?.entryCount ?? 0);
  const loadBlockingMs = Math.max(0, telemetry?.loadBlockingMs ?? 0);
  // Page load is not motion. Only the interaction window is scored; when the
  // run was never marked, fall back to the whole-run total rather than
  // reporting a clean 0 for a page that demonstrably blocked.
  const scrollBlockingMs = Math.max(
    0,
    telemetry?.interactionBlockingMs ?? totalBlockingMs
  );

  if (telemetry?.supported !== true) {
    return {
      loadBlockingMs,
      loafEntryCount,
      maxFrameMs,
      score: null,
      scrollBlockingMs,
      tier: null,
      totalBlockingMs,
      verdict: "unavailable",
    };
  }

  const score = interpolateBlockingBudget(scrollBlockingMs);
  return {
    loadBlockingMs,
    loafEntryCount,
    maxFrameMs,
    score,
    scrollBlockingMs,
    tier: tierFromScore(score),
    totalBlockingMs,
    verdict: verdictFromBlocking(scrollBlockingMs, score),
  };
};

/**
 * Combines two viewport measurements of the same page. The worst reading wins:
 * a viewport that measurably blocked frames is a real finding even when the other
 * viewport was clean, which mirrors the weakest-link rule used for model pillars.
 * Viewports that could not be measured are ignored here; their own result already
 * reports "unavailable".
 */
export const combineFrameTiming = (
  ...readings: (MeasuredFrameTiming | undefined)[]
): MeasuredFrameTiming => {
  const present = readings.filter(
    (r): r is MeasuredFrameTiming => r !== undefined
  );
  const measurable = present.filter((r) => r.score !== null);
  if (measurable.length === 0) {
    return {
      loadBlockingMs: 0,
      loafEntryCount: 0,
      maxFrameMs: 0,
      score: null,
      scrollBlockingMs: 0,
      tier: null,
      totalBlockingMs: 0,
      verdict: "unavailable",
    };
  }

  const worst = measurable.reduce((a, b) =>
    (a.score ?? 0) <= (b.score ?? 0) ? a : b
  );
  return {
    loadBlockingMs: Math.max(...present.map((r) => r.loadBlockingMs)),
    loafEntryCount: present.reduce((sum, r) => sum + r.loafEntryCount, 0),
    maxFrameMs: Math.max(...present.map((r) => r.maxFrameMs)),
    score: worst.score,
    scrollBlockingMs: Math.max(...present.map((r) => r.scrollBlockingMs)),
    tier: worst.tier,
    totalBlockingMs: Math.max(...present.map((r) => r.totalBlockingMs)),
    verdict: worst.verdict,
  };
};
