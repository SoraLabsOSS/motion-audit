/**
 * SoraLabs Motion Audit - 4-Pillar Scoring & Tier Mapping Engine
 *
 * Implements:
 * - Continuous score mapping [0, 100] to discrete performance tiers (S, A, B, C, D, F)
 * - 4-Pillar Viewport weighted aggregation with normalized distribution (sum = 1.0):
 *   Animations (0.35) + Scroll (0.25) + Thrashing (0.25) + GPU Pressure (0.15)
 * - Normalized convex combination reflecting multi-stage rendering impact
 * - Multi-viewport overall grade synthesis (Desktop + Mobile)
 */

export type PerformanceTier = "S" | "A" | "B" | "C" | "D" | "F";

export const TIER_ORDER: PerformanceTier[] = ["S", "A", "B", "C", "D", "F"];

export const tierFromScore = (score: number): PerformanceTier => {
  if (score >= 80) {
    return "S";
  }
  if (score >= 60) {
    return "A";
  }
  if (score >= 40) {
    return "B";
  }
  if (score >= 20) {
    return "C";
  }
  if (score >= 10) {
    return "D";
  }
  return "F";
};

export const averageTier = (tiers: PerformanceTier[]): PerformanceTier => {
  if (!tiers || tiers.length === 0) {
    return "S";
  }
  const cumulativeRank = tiers.reduce(
    (sum, t) => sum + Math.max(0, TIER_ORDER.indexOf(t)),
    0
  );
  const meanRank = Math.round(cumulativeRank / tiers.length);
  return TIER_ORDER[Math.max(0, Math.min(TIER_ORDER.length - 1, meanRank))];
};

export interface AnimationScoreAggregation {
  score: number;
  tier: PerformanceTier;
}

/**
 * Aggregates individual animation scores using pipeline bottleneck coupling.
 * In Chromium rendering architecture, animations executing on the main thread
 * (Layout / Paint) stall the 16.6ms frame budget regardless of how many lightweight
 * compositor animations coexist.
 * Blends the worst-offender score (30% weight) with population mean (70% weight)
 * and enforces a ceiling on catastrophic failures.
 */
export const aggregateAnimationScores = (
  scores: number[]
): AnimationScoreAggregation => {
  if (!scores || scores.length === 0) {
    return { score: 100, tier: "S" };
  }
  const worstScore = Math.min(...scores);
  const meanScore = scores.reduce((acc, s) => acc + s, 0) / scores.length;

  // 30% bottleneck coupling to worst offender, 70% population mean
  // Captures real rendering defects without letting a single isolated outlier crash the entire site grade
  let combined = Math.round(worstScore * 0.3 + meanScore * 0.7);

  // If there are multiple animations and worst is catastrophic (< 15), enforce Tier B ceiling (59)
  if (worstScore < 15 && scores.length >= 3) {
    combined = Math.min(combined, 59);
  }

  const finalScore = Math.max(0, Math.min(100, combined));
  return {
    score: finalScore,
    tier: tierFromScore(finalScore),
  };
};

export interface ViewportPillars {
  animations?: { score: number; tier: PerformanceTier };
  scrollAnimations?: { score: number; tier: PerformanceTier };
  thrashing?: { score: number; tier: PerformanceTier };
  gpuPressure?: { score: number; tier: PerformanceTier };
  fallbackScore?: number;
}

export interface ViewportScoreResult {
  score: number;
  tier: PerformanceTier;
}

export const computeViewportScore = (
  pillars: ViewportPillars
): ViewportScoreResult => {
  const mainThreadEntries: { score: number; weight: number }[] = [];
  if (pillars.animations) {
    mainThreadEntries.push({ score: pillars.animations.score, weight: 0.35 });
  }
  if (pillars.scrollAnimations) {
    mainThreadEntries.push({
      score: pillars.scrollAnimations.score,
      weight: 0.25,
    });
  }
  if (pillars.thrashing) {
    mainThreadEntries.push({ score: pillars.thrashing.score, weight: 0.25 });
  }

  if (mainThreadEntries.length === 0 && !pillars.gpuPressure) {
    const raw = pillars.fallbackScore ?? 100;
    return { score: raw, tier: tierFromScore(raw) };
  }

  let totalWeightedSum = 0;
  let totalWeight = 0;

  for (const { score, weight } of mainThreadEntries) {
    totalWeightedSum += score * weight;
    totalWeight += weight;
  }

  if (pillars.gpuPressure) {
    totalWeightedSum += pillars.gpuPressure.score * 0.15;
    totalWeight += 0.15;
  }

  // Optional pillars are normalized over the measurements that are present.
  // Callers must not use omission to mean a measured zero; missing telemetry
  // should be represented by an explicit neutral/unavailable evaluation.
  let finalScore =
    totalWeight > 0 ? Math.round(totalWeightedSum / totalWeight) : 100;

  // Pipeline Bottleneck Coupling (Amdahl's Law / Weakest-Link Principle):
  // Main thread frame execution is sequential (Script -> Layout -> Paint -> Composite).
  // A catastrophic bottleneck (< 15) in any single pillar breaks frame pacing.
  const allPillarScores = [
    ...mainThreadEntries.map((e) => e.score),
    ...(pillars.gpuPressure ? [pillars.gpuPressure.score] : []),
  ];
  if (allPillarScores.length > 0) {
    const minPillarScore = Math.min(...allPillarScores);
    if (minPillarScore < 15) {
      finalScore = Math.min(finalScore, 59);
    } else if (minPillarScore < 30) {
      finalScore = Math.min(finalScore, 75);
    }
  }

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    tier: tierFromScore(finalScore),
  };
};

export interface OverallAuditSynthesis {
  overallScore: number;
  overallTier: PerformanceTier;
}

export const synthesizeOverallAudit = (
  desktopScore: number,
  mobileScore: number,
  desktopTier: PerformanceTier,
  mobileTier: PerformanceTier
): OverallAuditSynthesis => ({
  overallScore: Math.round((desktopScore + mobileScore) / 2),
  overallTier: averageTier([desktopTier, mobileTier]),
});
