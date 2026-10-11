import {
  BrowserRunner,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
} from "./collector/runner.js";
import { generateAuditFindings } from "./diagnostics/findings.js";
import { synthesizeOverallAudit } from "./math/scoring-engine.js";
import type { MotionAuditReport, ViewportAuditResult } from "./types.js";

export type {
  AnimationFrameSample,
  AnimationSource,
  AuditFinding,
  CapturedAnimation,
  CapturedScroll,
  CdpLayer,
  FindingCategory,
  FindingSeverity,
  LayerSnapshotDelta,
  LongAnimationFrameTelemetry,
  MotionAuditReport,
  ScrollPhaseTelemetry,
  Tier,
  ViewportAuditResult,
  ViewportConfig,
} from "./types.js";

export {
  BrowserRunner,
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
} from "./collector/runner.js";

export {
  BYTES_PER_PIXEL,
  calculateRawTextureMemory,
  calculateTiledBufferMemory,
  evaluateGpuResourcePressure,
  DESKTOP_GPU_THRESHOLDS,
  MOBILE_GPU_THRESHOLDS,
} from "./math/vram.js";

export {
  BASELINE_PAINT_AREA_RATIO,
  calculateAnimationDurationMultiplier,
  calculateDurationMultiplier,
  calculateOffscreenPenaltyMultiplier,
  calculatePaintAreaMultiplier,
  calculateScrollBehaviorPenalty,
  calculateScrollListenerPenalty,
  classifyPropertyCost,
  classifyPropertyStage,
  getMaxPropertyCost,
  MAX_SCROLL_CONTENTION_PENALTY,
  normalizeCssProperty,
  OFFSCREEN_MUTATION_PENALTY_MULTIPLIER,
  PIPELINE_COSTS,
  RAIL_INSTANT_RESPONSE_MS,
  type PipelineStage,
  type ScrollBehaviorMetrics,
} from "./math/scaling.js";

export {
  calculateP75FrameConcurrency,
  calculatePeakFrameConcurrency,
  calculatePercentile,
  computeEffectiveConcurrency,
  computePerFrameCounts,
  type ConcurrencyMetrics,
  type FrameActiveEntry,
} from "./math/concurrency.js";

export {
  analyzeLayoutThrashing,
  calculateLongestReflowBurst,
  computeMaxConsecutiveRun,
  type ThrashViolation,
  type ThrashingAnalysisResult,
} from "./math/thrashing-graph.js";

export {
  aggregateAnimationScores,
  averageTier,
  computeViewportScore,
  synthesizeOverallAudit,
  TIER_ORDER,
  tierFromScore,
  type AnimationScoreAggregation,
  type OverallAuditSynthesis,
  type PerformanceTier,
  type ViewportPillars,
  type ViewportScoreResult,
} from "./math/scoring-engine.js";

export {
  generateIncidentRemediationPrompt,
  generateLayoutRefactorPrompt,
} from "./diagnostics/ai-prompt.js";

export { generateAuditFindings } from "./diagnostics/findings.js";
export { generateSvgBadge } from "./cli/badge.js";

export interface AuditRunOptions {
  desktopOnly?: boolean;
  mobileOnly?: boolean;
  onProgress?: (message: string) => void;
}

export const audit = async (
  rawUrl: string,
  options: AuditRunOptions = {}
): Promise<MotionAuditReport> => {
  const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const runner = new BrowserRunner();

  try {
    let desktopResult: ViewportAuditResult;
    let mobileResult: ViewportAuditResult;

    if (options.mobileOnly) {
      options.onProgress?.("Auditing mobile viewport...");
      mobileResult = await runner.auditViewport(
        url,
        MOBILE_VIEWPORT,
        options.onProgress
      );
      desktopResult = { ...mobileResult, viewport: DESKTOP_VIEWPORT };
    } else if (options.desktopOnly) {
      options.onProgress?.("Auditing desktop viewport...");
      desktopResult = await runner.auditViewport(
        url,
        DESKTOP_VIEWPORT,
        options.onProgress
      );
      mobileResult = { ...desktopResult, viewport: MOBILE_VIEWPORT };
    } else {
      options.onProgress?.("Auditing desktop viewport (1440x900 @ DPR 2)...");
      desktopResult = await runner.auditViewport(
        url,
        DESKTOP_VIEWPORT,
        options.onProgress
      );

      options.onProgress?.("Auditing mobile viewport (390x844 @ DPR 3)...");
      mobileResult = await runner.auditViewport(
        url,
        MOBILE_VIEWPORT,
        options.onProgress
      );
    }

    const synthesized = synthesizeOverallAudit(
      desktopResult.overallScore,
      mobileResult.overallScore,
      desktopResult.overallTier,
      mobileResult.overallTier
    );
    const findings = generateAuditFindings(url, desktopResult, mobileResult);

    return {
      desktop: desktopResult,
      findings,
      mobile: mobileResult,
      overallScore: synthesized.overallScore,
      overallTier: synthesized.overallTier,
      timestamp: new Date().toISOString(),
      url,
    };
  } finally {
    await runner.close();
  }
};
