import type { MeasuredFrameTiming } from "./math/frame-timing.js";

export type Tier = "S" | "A" | "B" | "C" | "D" | "F";

export interface ViewportConfig {
  width: number;
  height: number;
  dpr: number;
  label: "desktop" | "mobile";
}

export interface CdpLayer {
  layerId: string;
  backendNodeId?: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  paintCount: number;
  drawsContent: boolean;
  layerKind: "content_raster" | "tiled_scroller" | "structural_container";
  compositingReasons?: string[];
  isWillChangePromoted?: boolean;
  isOverlapPromoted?: boolean;
  compositedVramBytes: number;
  selector?: string;
  notes?: ("TILED" | "OVERLAP" | "WILL-CHANGE")[];
  tier?: Tier;
}

export type AnimationSource = "css-animation" | "waapi" | "js-loop";

export type AnimationKind =
  | "waapi"
  | "javascript"
  | "scroll-linked"
  | "scroll-triggered";

export interface CapturedAnimation {
  id: string;
  selector: string;
  properties: string[];
  source: AnimationSource;
  durationMs: number;
  iterations?: number;
  paintArea: number;
  isOffscreen?: boolean;
  tier: Tier;
  frames?: number[];
  kind?: AnimationKind;
  trigger?: string;
  notes?: string[];
  hasWillChange?: boolean;
  isPromoted?: boolean;
  frameCount?: number;
}

export interface CapturedScroll {
  listenerCount: number;
  usesPassive: boolean;
  usesRafOrDebounce: boolean;
  hasLayoutOnScroll: boolean;
  selectors: string[];
  scrollLinkedCount?: number;
  scrollTriggeredCount?: number;
  waapiCount?: number;
  jsCount?: number;
}

export interface LongAnimationFrameTelemetry {
  supported: boolean;
  entryCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  totalBlockingDurationMs: number;
}

export type {
  FrameTimingVerdict,
  MeasuredFrameTiming,
} from "./math/frame-timing.js";

export interface LayerSnapshotDelta {
  beforeCount: number;
  afterCount: number;
  addedLayerCount: number;
  removedLayerCount: number;
  changedPaintCount: number;
}

export interface AnimationFrameSample {
  selector: string;
  properties: string[];
  frames: number[];
}

export interface ScrollPhaseTelemetry {
  scrollEventCount: number;
  scrollFrameCount: number;
  animationSampleCount: number;
  scrollLinkedAnimationCount: number;
  scrollTriggeredCandidateCount: number;
}

export interface ThrashingBreakdown {
  mountCount: number;
  frameCount: number;
  maxConcurrentRaf: number;
}

export interface ViewportAuditResult {
  measured?: boolean;
  viewport: ViewportConfig;
  vramBytes: number;
  textureVramBytes?: number;
  tiledVramBytes?: number;
  layerCount: number;
  gpuScore: number;
  gpuTier: Tier;
  animationsScore: number;
  animationsTier: Tier;
  scrollScore: number;
  scrollTier: Tier;
  thrashingScore: number;
  thrashingTier: Tier;
  thrashingBreakdown?: ThrashingBreakdown;
  overallScore: number;
  overallTier: Tier;
  animations: CapturedAnimation[];
  scroll: CapturedScroll;
  layers: CdpLayer[];
  longAnimationFrames?: LongAnimationFrameTelemetry;
  /**
   * Measured main-thread blocking. This is the only figure in the report produced
   * by the browser's own frame timings rather than by the audit's inferred model.
   */
  frameTiming?: MeasuredFrameTiming;
  layerSnapshotDelta?: LayerSnapshotDelta;
  animationFrameSamples?: AnimationFrameSample[];
  scrollPhase?: ScrollPhaseTelemetry;
}

export type FindingCategory =
  | "gpu"
  | "will-change"
  | "layout-animation"
  | "scroll"
  | "thrashing"
  | "offscreen-animation"
  | "overlap";

export type FindingSeverity = "critical" | "high" | "medium" | "low";

export interface AuditFinding {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation: string;
  selectors?: string[];
  viewport: "desktop" | "mobile" | "both";
  fixPrompt?: string;
}

export interface MotionAuditReport {
  url: string;
  timestamp: string;
  /**
   * Primary result. Measured main-thread blocking from the Long Animation Frames
   * API, anchored on the published 50ms LoAF threshold and 200ms INP ceiling.
   * Prefer this over `overallScore` when the two disagree: this one is recorded
   * by the browser, the other is the audit's inferred model.
   */
  frameTiming: MeasuredFrameTiming;
  /**
   * Composite of the four inferred model pillars (animations, scroll, thrashing,
   * GPU). Diagnostic, not a measurement: its band edges and weights are
   * unvalidated operational targets.
   */
  overallScore: number;
  /** Tier derived from the inferred model score above. */
  overallTier: Tier;
  desktop: ViewportAuditResult;
  mobile: ViewportAuditResult;
  findings: AuditFinding[];
}
