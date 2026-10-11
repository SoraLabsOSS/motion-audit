/**
 * SoraLabs Motion Audit - Scaling Multipliers & Property Cost Engine
 *
 * Grounded in:
 * - W3C CSS Transforms Module Level 2 & CSS Animations Level 2 (Off-thread compositor properties)
 * - Chromium Rendering Architecture: Compositor vs Paint vs Layout pipeline stages
 * - Google RAIL Guidelines: 100ms threshold for instantaneous user perception
 * - Logarithmic penalty model for event listener concurrency (natural saturation)
 * - Fillrate area scaling relative to standard component viewport footprint (10% baseline)
 */

/**
 * Normalizes CSS property names to canonical lowercase kebab-case
 * (e.g. "backgroundColor" -> "background-color", "-webkit-transform" -> "transform").
 */
export const normalizeCssProperty = (property: string): string => {
  if (!property) {
    return "";
  }
  let prop = property.trim();
  // Preserve CSS custom properties
  if (prop.startsWith("--")) {
    return prop;
  }
  prop = prop
    .replace(/^-(?:webkit|moz|ms|o)-/u, "")
    .replace(/^(?:webkit|moz|ms|o)(?<letter>[A-Z])/u, "$<letter>");
  return prop
    .replaceAll(/(?<prefix>[a-z0-9])(?<upper>[A-Z])/gu, "$<prefix>-$<upper>")
    .toLowerCase();
};

/**
 * Common compositor candidates. Actual off-thread execution still depends on
 * browser version, element state, and whether the property is compositable.
 */
const COMPOSITOR_PIPELINE_PROPERTIES = new Set<string>([
  "transform",
  "translate",
  "rotate",
  "scale",
  "opacity",
  "filter",
  "backdrop-filter",
  "clip-path",
  "offset-path",
  "offset-distance",
  "offset-rotate",
  "transform-origin",
  "perspective",
  "perspective-origin",
  "will-change",
]);

const PAINT_EXACT_PROPERTIES = new Set<string>([
  "color",
  "visibility",
  "mix-blend-mode",
  "fill",
  "caret-color",
  "accent-color",
]);

/**
 * Heuristic classification for the scoring model; it is not a browser trace.
 */
const isPaintPipelineProperty = (prop: string): boolean => {
  if (prop.startsWith("background")) {
    return true;
  }
  if (prop.startsWith("border") && !prop.includes("width")) {
    return true;
  }
  if (
    prop.startsWith("outline") ||
    prop.startsWith("mask") ||
    prop.startsWith("text-decoration")
  ) {
    return true;
  }
  if (prop.endsWith("color") || prop.endsWith("shadow")) {
    return true;
  }
  return PAINT_EXACT_PROPERTIES.has(prop) || prop.startsWith("stroke");
};

/**
 * Pipeline Invalidation Stages derived from Chromium Blink CSSPropertyMetadata:
 * - Compositor: Off-thread execution via cc::AnimationHost. Zero main-thread pipeline penalty.
 * - CSS Variable: Unregistered CSS Custom properties force descendant style invalidations.
 * - Paint: Triggers main-thread rasterization invalidation without geometric reflow.
 * - Layout: Forces synchronous geometric tree reflow, invalidating Layout, Paint, and Composite.
 */
export const PIPELINE_COSTS = {
  COMPOSITOR: 0,
  CSS_VARIABLE: 15,
  LAYOUT: 50,
  PAINT: 20,
} as const;

export type PipelineStage =
  | "compositor"
  | "custom-property"
  | "paint"
  | "layout";

export const classifyPropertyStage = (property: string): PipelineStage => {
  if (!property) {
    return "compositor";
  }
  const normalized = normalizeCssProperty(property);
  if (normalized.startsWith("--")) {
    return "custom-property";
  }
  if (COMPOSITOR_PIPELINE_PROPERTIES.has(normalized)) {
    return "compositor";
  }
  if (isPaintPipelineProperty(normalized)) {
    return "paint";
  }
  return "layout";
};

export const classifyPropertyCost = (property: string): number => {
  const stage = classifyPropertyStage(property);
  switch (stage) {
    case "compositor": {
      return PIPELINE_COSTS.COMPOSITOR;
    }
    case "custom-property": {
      return PIPELINE_COSTS.CSS_VARIABLE;
    }
    case "paint": {
      return PIPELINE_COSTS.PAINT;
    }
    case "layout": {
      return PIPELINE_COSTS.LAYOUT;
    }
    default: {
      return PIPELINE_COSTS.LAYOUT;
    }
  }
};

export const getMaxPropertyCost = (properties: string[]): number => {
  if (!properties || properties.length === 0) {
    return PIPELINE_COSTS.COMPOSITOR;
  }
  return Math.max(...properties.map(classifyPropertyCost));
};

// 10% viewport surface represents a typical interactive component/card
export const BASELINE_PAINT_AREA_RATIO = 0.1;

export const calculatePaintAreaMultiplier = (
  paintArea?: number,
  viewportArea?: number
): number => {
  if (!paintArea || !viewportArea || viewportArea <= 0) {
    return 1;
  }
  const ratio = paintArea / viewportArea;
  return Math.max(0.25, Math.min(4, ratio / BASELINE_PAINT_AREA_RATIO));
};

// Google RAIL Performance Model: < 100ms response feels instantaneous
export const RAIL_INSTANT_RESPONSE_MS = 100;

export const calculateDurationMultiplier = (durationMs?: number): number => {
  if (durationMs === undefined || durationMs === null || durationMs <= 0) {
    return 1;
  }
  return Math.max(0.25, Math.min(1, durationMs / RAIL_INSTANT_RESPONSE_MS));
};

/**
 * Repeated animations should not receive a micro-interaction discount forever.
 * Infinite animations are treated as sustained exposure for this operational model.
 */
export const calculateAnimationDurationMultiplier = (
  durationMs?: number,
  iterations = 1
): number => {
  if (durationMs === undefined || durationMs === null || durationMs <= 0) {
    return 1;
  }
  const normalizedIterations = Number.isFinite(iterations)
    ? Math.max(1, iterations)
    : 10;
  return calculateDurationMultiplier(
    durationMs * Math.min(normalizedIterations, 10)
  );
};

/**
 * Evaluates scroll listener overhead based on main-thread dispatch contention.
 * Scales logarithmically with listener volume to model task queue pressure.
 * In Chromium, passive listeners avoid compositor thread blocking; raw count only adds task queue burden.
 */
export const MAX_SCROLL_CONTENTION_PENALTY = 30;

export const calculateScrollListenerPenalty = (
  listenerCount: number
): number => {
  if (listenerCount <= 0) {
    return 0;
  }
  // Natural saturation curve based on event loop dispatch queue pressure
  const penalty = Math.round(7 * Math.log2(1 + listenerCount));
  return Math.min(penalty, MAX_SCROLL_CONTENTION_PENALTY);
};

export interface ScrollBehaviorMetrics {
  listenerCount: number;
  nonPassiveCount: number;
  unoptimizedCount: number;
  hasLayoutOnScroll: boolean;
}

export const calculateScrollBehaviorPenalty = (
  metrics: ScrollBehaviorMetrics
): number => {
  const listenerPenalty = calculateScrollListenerPenalty(metrics.listenerCount);
  const passivePenalty = Math.min(15, Math.max(0, metrics.nonPassiveCount) * 5);
  const schedulingPenalty = Math.min(
    15,
    Math.max(0, metrics.unoptimizedCount) * 3
  );
  const layoutPenalty = metrics.hasLayoutOnScroll ? 20 : 0;
  return Math.min(
    60,
    listenerPenalty + passivePenalty + schedulingPenalty + layoutPenalty
  );
};

/**
 * Penalty multiplier for animations running offscreen.
 * Grounded in Chromium Blink pipeline:
 * Offscreen animations modifying Layout or Paint invalidate geometry/raster without user visibility.
 * Pure compositor animations (transform/opacity) remain unpenalized (1.0x) to avoid double-penalty with GPU VRAM.
 */
export const OFFSCREEN_MUTATION_PENALTY_MULTIPLIER = 1.5;

export const calculateOffscreenPenaltyMultiplier = (
  isOffscreen = false,
  propertyCost?: number
): number => {
  if (!isOffscreen) {
    return 1;
  }
  if (!propertyCost || propertyCost <= PIPELINE_COSTS.COMPOSITOR) {
    return 1;
  }
  return OFFSCREEN_MUTATION_PENALTY_MULTIPLIER;
};
