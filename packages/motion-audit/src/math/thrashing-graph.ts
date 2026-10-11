/**
 * SoraLabs Motion Audit - Chromium Cumulative Reflow & Layout Invalidation Analyzer
 *
 * Grounded in:
 * - Chromium Blink Layout Invalidation Engine (LayoutObject::UpdateLayout)
 * - W3C Long Animation Frames (LoAF) forced reflow budget (16.6ms frame budget)
 * - Scope Invalidation: Root/Document-level forced reflows vs leaf subtree mutations
 * - O(N) Longest Consecutive Burst Sequence Analysis (Hash Set clustering)
 */

export interface ThrashViolation {
  type: "style" | "layout";
  api: string;
  phase?: string;
  frame: number;
  writeSelector?: string;
  writeProperty?: string;
  readSelector?: string;
}

export interface ThrashingAnalysisResult {
  totalPenalty: number;
  score: number;
  violationFrames: number;
  maxConsecutiveFrames: number;
  reflowCount: number;
  affectedSelectors: string[];
}

/**
 * Calculates the longest continuous consecutive frame burst using an O(N) hash set lookup.
 */
export const calculateLongestReflowBurst = (frames: number[]): number => {
  if (!frames || frames.length === 0) {
    return 0;
  }
  const frameSet = new Set(frames);
  let maxBurst = 0;

  for (const f of frameSet) {
    // Only check streak starting from the beginning of a sequence
    if (!frameSet.has(f - 1)) {
      let streak = 1;
      while (frameSet.has(f + streak)) {
        streak += 1;
      }
      if (streak > maxBurst) {
        maxBurst = streak;
      }
    }
  }

  return maxBurst;
};

// Canonical export
export const computeMaxConsecutiveRun = calculateLongestReflowBurst;

const isRootSelector = (s?: string): boolean =>
  Boolean(
    s && /^(?:html|body|document|window|#root|#__next)(?:\s+|>|$)/iu.test(s)
  );

const computeFrameCost = (frameViolations: ThrashViolation[]): number => {
  const selectorChains = Map.groupBy(
    frameViolations,
    (v) => v.readSelector || v.writeSelector || "unknown"
  );

  let frameCost = 0;
  for (const [sel, chain] of selectorChains.entries()) {
    const hasLayout = chain.some((v) => v.type === "layout");
    const baseCost = hasLayout ? 5 : 2;

    const isGlobalScope =
      isRootSelector(sel) ||
      chain.some(
        (v) => isRootSelector(v.writeSelector) || isRootSelector(v.readSelector)
      );
    const scopeMultiplier = isGlobalScope ? 1.5 : 1;

    const k = chain.length;
    const chainRepetitionFactor =
      k <= 1 ? 1 : Math.min(3.5, 1 + Math.log2(k) * 1.2);

    frameCost += baseCost * scopeMultiplier * chainRepetitionFactor;
  }

  const m = selectorChains.size;
  const distinctMultiplier = m <= 1 ? 1 : Math.min(1.5, 1 + Math.log2(m) * 0.4);
  return frameCost * distinctMultiplier;
};

const computeInitPenalty = (initViolations: ThrashViolation[]): number => {
  const dedupedInitKeys = new Set<string>();
  let initPenalty = 0;
  for (const v of initViolations) {
    const key = `${v.type}:${v.api}:${v.readSelector || ""}`;
    if (!dedupedInitKeys.has(key)) {
      dedupedInitKeys.add(key);
      initPenalty += v.type === "layout" ? 3 : 1;
    }
  }
  return Math.min(15, initPenalty);
};

/**
 * Analyzes forced synchronous layout violations using the Chromium Cumulative Reflow Model.
 */
export const analyzeLayoutThrashing = (
  violations: ThrashViolation[]
): ThrashingAnalysisResult => {
  if (!violations || violations.length === 0) {
    return {
      affectedSelectors: [],
      maxConsecutiveFrames: 0,
      reflowCount: 0,
      score: 100,
      totalPenalty: 0,
      violationFrames: 0,
    };
  }

  const initViolations = violations.filter(
    (v) => v.phase === "init" || v.frame === 0
  );
  const runtimeViolations = violations.filter(
    (v) => v.phase !== "init" && v.frame !== 0
  );

  const frameMap = new Map<number, ThrashViolation[]>();
  const affectedSelectorsSet = new Set<string>();

  for (const v of runtimeViolations) {
    const existing = frameMap.get(v.frame);
    if (existing) {
      existing.push(v);
    } else {
      frameMap.set(v.frame, [v]);
    }
    if (v.writeSelector) {
      affectedSelectorsSet.add(v.writeSelector);
    }
    if (v.readSelector) {
      affectedSelectorsSet.add(v.readSelector);
    }
  }

  for (const v of initViolations) {
    if (v.writeSelector) {
      affectedSelectorsSet.add(v.writeSelector);
    }
    if (v.readSelector) {
      affectedSelectorsSet.add(v.readSelector);
    }
  }

  const initPenalty = computeInitPenalty(initViolations);

  const frames = [...frameMap.keys()];
  const maxConsecutive = calculateLongestReflowBurst(frames);

  let runtimePenalty = 0;
  for (const [, frameViolations] of frameMap.entries()) {
    runtimePenalty += computeFrameCost(frameViolations);
  }

  const consecutiveMultiplier =
    maxConsecutive >= 8 ? 2.5 : 1 + Math.min(1.5, (maxConsecutive / 3) * 0.5);
  const totalPenalty = Math.min(
    100,
    Math.round(runtimePenalty * consecutiveMultiplier + initPenalty)
  );
  const score = Math.max(0, 100 - totalPenalty);

  return {
    affectedSelectors: [...affectedSelectorsSet],
    maxConsecutiveFrames: maxConsecutive,
    reflowCount: violations.length,
    score,
    totalPenalty,
    violationFrames: frames.length,
  };
};
