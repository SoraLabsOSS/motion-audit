import { tierFromScore } from "../math/scoring-engine.js";
import type { Tier } from "../types.js";

export const TIER_COLORS: Record<Tier, string> = {
  // Green
  A: "#2ea44f",
  // Blue
  B: "#007ec6",
  // Orange / Amber
  C: "#fe7d37",
  // Dark Orange
  D: "#ea580c",
  // Red
  F: "#e05d44",
  // Gold / Yellow
  S: "#dfb317",
};

export const getTierColor = (tier?: Tier | string, score?: number): string => {
  if (tier) {
    const normalized = tier.toUpperCase();
    if (normalized in TIER_COLORS) {
      // SAFETY: Property membership in TIER_COLORS confirms valid Tier key
      return TIER_COLORS[normalized as Tier];
    }
  }
  if (score !== undefined) {
    const calculatedTier = tierFromScore(score);
    return TIER_COLORS[calculatedTier];
  }
  return TIER_COLORS.S;
};

export interface BadgeOptions {
  label?: string;
}

export const generateSvgBadge = (
  tier: Tier | string,
  score: number,
  options?: BadgeOptions
): string => {
  const rawTier = tier ? tier.toUpperCase() : tierFromScore(score);
  // SAFETY: Checked membership in TIER_COLORS ensures type safety
  const resolvedTier: Tier = rawTier in TIER_COLORS ? (rawTier as Tier) : "S";
  const color = getTierColor(resolvedTier, score);
  const label = options?.label ?? "motion audit";
  const value = `Tier ${resolvedTier} · ${score}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="168" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="90" height="20" fill="#24292e"/>
    <rect x="90" width="78" height="20" fill="${color}"/>
    <rect width="168" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="460" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="760">${label}</text>
    <text x="460" y="140" transform="scale(.1)" fill="#fff" textLength="760">${label}</text>
    <text aria-hidden="true" x="1280" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="640">${value}</text>
    <text x="1280" y="140" transform="scale(.1)" fill="#fff" textLength="640">${value}</text>
  </g>
</svg>
`;
};
