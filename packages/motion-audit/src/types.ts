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
}

export type AnimationSource =
  | "css-transition"
  | "css-animation"
  | "waapi"
  | "js-loop";

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
}

export interface CapturedScroll {
  listenerCount: number;
  usesPassive: boolean;
  usesRafOrDebounce: boolean;
  hasLayoutOnScroll: boolean;
  selectors: string[];
}

export interface LongAnimationFrameTelemetry {
  supported: boolean;
  entryCount: number;
  totalDurationMs: number;
  maxDurationMs: number;
  totalBlockingDurationMs: number;
}

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

export interface ViewportAuditResult {
  viewport: ViewportConfig;
  vramBytes: number;
  layerCount: number;
  gpuScore: number;
  gpuTier: Tier;
  animationsScore: number;
  animationsTier: Tier;
  scrollScore: number;
  scrollTier: Tier;
  thrashingScore: number;
  thrashingTier: Tier;
  overallScore: number;
  overallTier: Tier;
  animations: CapturedAnimation[];
  scroll: CapturedScroll;
  layers: CdpLayer[];
  longAnimationFrames?: LongAnimationFrameTelemetry;
  layerSnapshotDelta?: LayerSnapshotDelta;
  animationFrameSamples?: AnimationFrameSample[];
  scrollPhase?: ScrollPhaseTelemetry;
}

export type FindingCategory =
  | "gpu"
  | "blur"
  | "will-change"
  | "layout-animation"
  | "scroll"
  | "thrashing"
  | "offscreen-animation";

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
  overallScore: number;
  overallTier: Tier;
  desktop: ViewportAuditResult;
  mobile: ViewportAuditResult;
  findings: AuditFinding[];
}
