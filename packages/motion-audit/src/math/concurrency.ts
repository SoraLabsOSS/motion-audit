/**
 * SoraLabs Motion Audit - Animation Timeline Concurrency & Contention Engine
 *
 * Grounded in:
 * - W3C Web Animations API active timeline overlapping intervals
 * - Main-Thread Task Contention: evaluating peak burst vs sustained concurrent workload
 * - Standard discrete statistical percentiles (NIST linear interpolation)
 */

export interface FrameActiveEntry {
  frames?: number[];
}

export const calculatePercentile = (
  values: number[],
  percentile = 75
): number => {
  if (!values || values.length === 0) {
    return 0;
  }
  const sorted = values.toSorted((a, b) => a - b);
  if (percentile <= 0) {
    return sorted[0];
  }
  if (percentile >= 100) {
    return sorted.at(-1) ?? 0;
  }

  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
};

export const computePerFrameCounts = (
  entries: FrameActiveEntry[]
): number[] => {
  const frameCounts = new Map<number, number>();
  for (const entry of entries) {
    if (!entry.frames || !Array.isArray(entry.frames)) {
      continue;
    }
    for (const frame of entry.frames) {
      frameCounts.set(frame, (frameCounts.get(frame) ?? 0) + 1);
    }
  }
  return [...frameCounts.values()];
};

export const calculatePeakFrameConcurrency = (
  entries: FrameActiveEntry[],
  precomputedCounts?: number[]
): number => {
  const counts = precomputedCounts ?? computePerFrameCounts(entries);
  return counts.length > 0 ? Math.max(...counts) : entries.length;
};

export const calculateP75FrameConcurrency = (
  entries: FrameActiveEntry[],
  precomputedCounts?: number[]
): number => {
  const counts = precomputedCounts ?? computePerFrameCounts(entries);
  return counts.length > 0 ? calculatePercentile(counts, 75) : entries.length;
};

export interface ConcurrencyMetrics {
  maxConcurrent: number;
  meanConcurrent: number;
  p75Concurrent: number;
  effectiveConcurrent: number;
}

/**
 * Computes effective concurrent animation load balancing sustained mean density
 * with peak contention spikes.
 */
export const computeEffectiveConcurrency = (
  entries: FrameActiveEntry[]
): ConcurrencyMetrics => {
  if (entries.length === 0) {
    return {
      effectiveConcurrent: 0,
      maxConcurrent: 0,
      meanConcurrent: 0,
      p75Concurrent: 0,
    };
  }

  const counts = computePerFrameCounts(entries);
  if (counts.length === 0) {
    return {
      effectiveConcurrent: entries.length,
      maxConcurrent: entries.length,
      meanConcurrent: entries.length,
      p75Concurrent: entries.length,
    };
  }

  const maxConcurrent = Math.max(...counts);
  const sum = counts.reduce((acc, c) => acc + c, 0);
  const meanConcurrent = Math.round((sum / counts.length) * 10) / 10;
  const p75Concurrent = calculatePercentile(counts, 75);

  // Effective load: weighted balance between sustained average and peak burst
  const effectiveConcurrent = Math.round(
    0.6 * meanConcurrent + 0.4 * maxConcurrent
  );

  return {
    effectiveConcurrent: Math.max(1, effectiveConcurrent),
    maxConcurrent,
    meanConcurrent,
    p75Concurrent,
  };
};
