import { setTimeout as sleep } from "node:timers/promises";

import type { Browser, CDPSession } from "puppeteer";
import { connect, launch } from "puppeteer";

import {
  calculateConcurrencyPenalty,
  computeEffectiveConcurrency,
} from "../math/concurrency.js";
import { evaluateMeasuredFrameTiming } from "../math/frame-timing.js";
import {
  calculateAnimationDurationMultiplier,
  calculateOffscreenPenaltyMultiplier,
  calculatePaintAreaMultiplier,
  calculateScrollBehaviorPenalty,
  calculateScrollDrivenAnimationPenalty,
  classifyPropertyCost,
  PIPELINE_COSTS,
  resolveEffectivePropertyCost,
} from "../math/scaling.js";
import {
  aggregateAnimationScores,
  computeViewportScore,
  tierFromScore,
} from "../math/scoring-engine.js";
import type { ThrashViolation } from "../math/thrashing-graph.js";
import { analyzeLayoutThrashing } from "../math/thrashing-graph.js";
import {
  calculateRawTextureMemory,
  calculateTiledLayerMemory,
  evaluateGpuResourcePressure,
} from "../math/vram.js";
import type {
  AnimationFrameSample,
  AnimationKind,
  CapturedAnimation,
  CdpLayer,
  LoafFrameEntry,
  LongAnimationFrameTelemetry,
  Tier,
  ViewportAuditResult,
  ViewportConfig,
} from "../types.js";
import { INPAGE_INIT_SCRIPT } from "./inpage.js";

export const DESKTOP_VIEWPORT: ViewportConfig = {
  dpr: 2,
  height: 900,
  label: "desktop",
  width: 1440,
};

export const MOBILE_VIEWPORT: ViewportConfig = {
  dpr: 3,
  height: 844,
  label: "mobile",
  width: 390,
};

const NTH_CHILD_WILDCARD = ":nth-child(*)";
const NTH_CHILD_REGEX = /:nth-child\(\d+\)/gu;

const normalizeSelectorWildcard = (selector: string): string =>
  (selector || "").replaceAll(NTH_CHILD_REGEX, NTH_CHILD_WILDCARD);

type LayerKind = "content_raster" | "tiled_scroller" | "structural_container";

const determineLayerKind = (
  drawsContent: boolean,
  isTiled: boolean
): LayerKind => {
  if (!drawsContent) {
    return "structural_container";
  }
  return isTiled ? "tiled_scroller" : "content_raster";
};

interface RawCdpLayer {
  layerId: string;
  backendNodeId?: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  paintCount: number;
  drawsContent: boolean;
  scrollRects?: { type: string }[];
}

interface CdpCompositingReasons {
  compositingReasons?: string[];
}

type ThrashMutationType = "read" | "write" | "style" | "layout";

interface InpageThrashingRecord {
  type: ThrashMutationType;
  property: string;
  selector: string;
  frameIndex: number;
  phase?: string;
}

// CapturedAnimation before the collector grades it.
type TelemetryAnimation = Omit<CapturedAnimation, "tier"> & {
  tier?: Tier;
};

interface InpageMotionAuditApi {
  getScrollData: () => {
    listeners: {
      selector: string;
      passive: boolean;
      hasRafOrDebounce: boolean;
    }[];
    hasLayoutOnScroll: boolean;
  };
  getThrashingData: () => InpageThrashingRecord[];
  getThrashingBreakdown?: () => {
    mountCount: number;
    frameCount: number;
    maxConcurrentRaf: number;
  };
  getJsAnimations: () => TelemetryAnimation[];
  getAccumulatedWaapiAnimations?: () => TelemetryAnimation[];
  markInteractionStart?: () => number;
  getLongAnimationFrameData: () => {
    supported: boolean;
    entries: LoafFrameEntry[];
  };
  getWaapiAnimationFrames: () => AnimationFrameSample[];
  getScrollPhaseData: () => {
    scrollEventCount: number;
    scrollFrameCount: number;
    animationSampleCount: number;
    scrollLinkedAnimationCount: number;
    scrollTriggeredCandidateCount: number;
  };
  getSelector?: (el: Element | null) => string;
  getUntrackedRect?: (el: Element) => DOMRect;
  getUntrackedStyle?: (
    el: Element,
    pseudoElt?: string | null
  ) => CSSStyleDeclaration | null;
}

declare global {
  interface Window {
    __MOTION_AUDIT__?: InpageMotionAuditApi;
    FramerMotion?: unknown;
    gsap?: unknown;
    ScrollTrigger?: unknown;
    anime?: unknown;
    lottie?: unknown;
  }
}

const hasCompositingReason = (reasons: string[], terms: string[]): boolean =>
  reasons.some((reason) => {
    const normalized = reason.toLowerCase();
    return terms.some((term) => normalized.includes(term));
  });

const noopHandler = (): void => {
  // no-op handler
};

const mapChunks = async <T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    // oxlint-disable-next-line eslint/no-await-in-loop
    results.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return results;
};

const resolveLayerCompositingReasons = async (
  cdp: CDPSession,
  layers: RawCdpLayer[]
): Promise<Map<string, string[]>> => {
  const entries = await mapChunks(layers, 25, async (layer) => {
    try {
      // SAFETY: CDP LayerTree.compositingReasons returns compositing reasons array
      const result = (await cdp.send("LayerTree.compositingReasons", {
        layerId: layer.layerId,
      })) as CdpCompositingReasons;
      const reasons: string[] = result.compositingReasons ?? [];
      return [layer.layerId, reasons] as const;
    } catch {
      const fallback: string[] = [];
      return [layer.layerId, fallback] as const;
    }
  });
  return new Map(entries);
};

const DESCRIBE_NODE_FN = `function() {
  function describe(el) {
    if (!el || !el.tagName) return '';
    var tag = el.tagName.toLowerCase();
    if (el.id) return tag + '#' + el.id;
    var cls = null;
    if (el.className && typeof el.className === 'string') cls = el.className;
    else if (typeof el.getAttribute === 'function') cls = el.getAttribute('class');
    if (cls) {
      var list = cls.trim().split(/\\s+/).filter(Boolean);
      if (list.length > 0) return tag + '.' + list.join('.');
    }
    var parent = el.parentElement;
    if (parent) {
      var kids = parent.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] === el) return tag + ':nth-child(' + (i + 1) + ')';
      }
    }
    return tag;
  }
  var el = this;
  if (!el) return '';
  if (el.nodeType === 9) return '#document';
  if (!el.tagName) return '';
  var parts = [];
  var current = el;
  var depth = 0;
  while (current && current.nodeType === 1 && depth < 6) {
    var part = describe(current);
    if (!part) break;
    parts.unshift(part);
    if (current.id || current === document.body || current === document.documentElement) break;
    current = current.parentElement;
    depth++;
  }
  return parts.join(' > ');
}`;

const resolveSelectorViaJs = async (
  cdp: CDPSession,
  backendNodeId: number
): Promise<string> => {
  try {
    // SAFETY: DOM.resolveNode returns an object with objectId if node exists
    const { object } = (await cdp.send("DOM.resolveNode", {
      backendNodeId,
    })) as { object?: { objectId?: string } };

    if (!object?.objectId) {
      return "";
    }

    // SAFETY: Runtime.callFunctionOn with returnByValue returns value in result
    const { result } = (await cdp.send("Runtime.callFunctionOn", {
      functionDeclaration: DESCRIBE_NODE_FN,
      objectId: object.objectId,
      returnByValue: true,
    })) as { result?: { value?: string } };

    const selector = result?.value ?? "";
    await cdp
      .send("Runtime.releaseObject", { objectId: object.objectId })
      .catch(noopHandler);
    return selector;
  } catch {
    // Resolution via JS runtime failed
    return "";
  }
};

const resolveSelectorViaDescribe = async (
  cdp: CDPSession,
  backendNodeId: number
): Promise<string> => {
  try {
    // SAFETY: DOM.describeNode returns node metadata including attributes
    const { node } = (await cdp.send("DOM.describeNode", {
      backendNodeId,
    })) as { node?: { attributes?: string[]; nodeName?: string } };

    if (!node?.nodeName) {
      return "";
    }

    const tag = node.nodeName.toLowerCase();
    const attrs = node.attributes ?? [];
    let id = "";
    let className = "";
    for (let j = 0; j < attrs.length; j += 2) {
      if (attrs[j] === "id") {
        id = attrs[j + 1];
      }
      if (attrs[j] === "class") {
        className = attrs[j + 1];
      }
    }
    if (id) {
      return `${tag}#${id}`;
    }
    if (className) {
      return `${tag}.${className.trim().split(/\s+/u).join(".")}`;
    }
    if (tag === "#document") {
      return "#document";
    }
    return tag === "#text" ? "" : tag;
  } catch {
    // DOM describe failed
    return "";
  }
};

const resolveFallbackSelector = (
  layer: RawCdpLayer,
  viewport: ViewportConfig,
  reasons: string[]
): string => {
  const joined = reasons.join(" ").toLowerCase();
  const isCoveringViewport =
    layer.offsetX === 0 &&
    layer.offsetY === 0 &&
    layer.width >= viewport.width &&
    layer.height >= viewport.height;
  const isDocOrRoot = joined.includes("root") || joined.includes("document");

  if (isDocOrRoot || isCoveringViewport) {
    return "#document";
  }
  if (joined.includes("overlap")) {
    return "<overlap>";
  }
  return "<layer>";
};

const resolveSingleLayerSelector = async (
  cdp: CDPSession,
  layer: RawCdpLayer,
  viewport: ViewportConfig,
  reasons: string[]
): Promise<string> => {
  let selector = "";
  if (layer.backendNodeId) {
    selector = await resolveSelectorViaJs(cdp, layer.backendNodeId);
    if (!selector) {
      selector = await resolveSelectorViaDescribe(cdp, layer.backendNodeId);
    }
  }
  if (!selector) {
    selector = resolveFallbackSelector(layer, viewport, reasons);
  }
  return selector;
};

const resolveAllLayerSelectors = async (
  cdp: CDPSession,
  layers: RawCdpLayer[],
  viewport: ViewportConfig,
  compositingReasons: Map<string, string[]>
): Promise<Map<string, string>> => {
  const entries = await mapChunks(layers, 25, async (layer) => {
    const reasons = compositingReasons.get(layer.layerId) ?? [];
    const selector = await resolveSingleLayerSelector(
      cdp,
      layer,
      viewport,
      reasons
    );
    return [layer.layerId, selector] as const;
  });
  return new Map(entries);
};

interface ScoredAnimationsEvaluation {
  activeConcurrency: number;
  animationsScore: number;
  scoredAnims: CapturedAnimation[];
}

const evaluateScoredAnimations = (
  animations: TelemetryAnimation[],
  samples: AnimationFrameSample[],
  viewportArea: number
): ScoredAnimationsEvaluation => {
  const animRawScores: number[] = [];
  const normalizedSamples = samples.map((sample) => ({
    frames: sample.frames,
    norm: normalizeSelectorWildcard(sample.selector),
    properties: sample.properties,
  }));

  const animationsWithFrames = animations.map((animation) => {
    const norm = normalizeSelectorWildcard(animation.selector);
    const match = normalizedSamples.find(
      (sample) =>
        (sample.norm === norm || sample.norm.endsWith(` > ${norm}`)) &&
        sample.properties.some((property) =>
          animation.properties.includes(property)
        )
    );
    return match ? { ...animation, frames: match.frames } : animation;
  });

  const seenAnimKeys = new Set<string>();
  const dedupedAnims = animationsWithFrames.filter((a) => {
    const norm = normalizeSelectorWildcard(a.selector);
    const aProps = a.properties.toSorted().join(",");
    const key = `${norm}|${a.source}|${aProps}`;
    if (seenAnimKeys.has(key)) {
      return false;
    }
    seenAnimKeys.add(key);
    return true;
  });

  const scoredAnims: CapturedAnimation[] = dedupedAnims.map((a) => {
    // Promotion decides whether a compositor-classified property is actually
    // free: transform/opacity are promoted by Chromium regardless, but filter and
    // friends silently degrade to a per-frame main-thread paint when they are not.
    const maxCost = resolveEffectivePropertyCost(a.properties, a.isPromoted);
    const areaMult = calculatePaintAreaMultiplier(a.paintArea, viewportArea);
    const durDiscount = calculateAnimationDurationMultiplier(
      a.durationMs,
      a.iterations
    );
    const offscreenMult = calculateOffscreenPenaltyMultiplier(
      a.isOffscreen,
      maxCost
    );
    // No per-animation ceiling: the worst-offender weighting in
    // aggregateAnimationScores already contains outliers, and capping here made
    // catastrophic layout animations (score < 15) unreachable in production.
    const penalty = maxCost * areaMult * durDiscount * offscreenMult;
    const score = Math.max(0, Math.round(100 - penalty));

    const tier = a.tier ?? tierFromScore(score);
    const notes = [...(a.notes || [])];

    animRawScores.push(score);
    return {
      ...a,
      notes,
      tier,
    };
  });

  // Only animations that actually run on the main thread contend for it. Compositor
  // animations are sampled by cc::AnimationHost off-thread, so charging them for
  // main-thread contention would contradict their own zero pipeline cost.
  const mainThreadAnims = scoredAnims.filter(
    (a) =>
      a.properties?.some(
        (p) => classifyPropertyCost(p) > PIPELINE_COSTS.COMPOSITOR
      ) ?? false
  );
  const hasAnyFrames =
    mainThreadAnims.length > 0 &&
    mainThreadAnims.some((a) => a.frames && a.frames.length > 0);
  const concurrencyMetrics = hasAnyFrames
    ? computeEffectiveConcurrency(
        mainThreadAnims.map((a) => ({ frames: a.frames ?? [0] }))
      )
    : null;
  const activeConcurrency = concurrencyMetrics?.effectiveConcurrent ?? 0;

  const animEval = aggregateAnimationScores(animRawScores);
  const concurrencyDeduction = concurrencyMetrics
    ? calculateConcurrencyPenalty(concurrencyMetrics)
    : 0;
  const animationsScore = Math.max(
    0,
    Math.min(100, animEval.score - concurrencyDeduction)
  );

  return {
    activeConcurrency,
    animationsScore,
    scoredAnims,
  };
};

export class BrowserRunner {
  private browser: Browser | null = null;

  launch = async (onProgress?: (msg: string) => void): Promise<Browser> => {
    if (this.browser) {
      return this.browser;
    }

    if (process.env.PUPPETEER_WS_ENDPOINT) {
      onProgress?.("Connecting to remote browser cluster via WebSocket...");
      this.browser = await connect({
        browserWSEndpoint: process.env.PUPPETEER_WS_ENDPOINT,
      });
      return this.browser;
    }

    const launchArgs = [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ];

    if (process.env.MOTION_AUDIT_NO_SANDBOX) {
      launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");
    }

    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    try {
      this.browser = await launch({
        args: launchArgs,
        channel: executablePath ? undefined : "chrome",
        executablePath,
        headless: true,
      });
    } catch (systemBrowserError) {
      try {
        this.browser = await launch({
          args: launchArgs,
          executablePath,
          headless: true,
        });
      } catch {
        throw systemBrowserError;
      }
    }
    return this.browser;
  };

  auditViewport = async (
    url: string,
    viewport: ViewportConfig,
    onProgress?: (msg: string) => void
  ): Promise<ViewportAuditResult> => {
    const browser = this.browser ?? (await this.launch(onProgress));
    const page = await browser.newPage();
    try {
      const cdp = await page.createCDPSession();
      let latestLayers: RawCdpLayer[] = [];

      const onLayers = (params: { layers?: RawCdpLayer[] }) => {
        if (Array.isArray(params.layers)) {
          latestLayers = params.layers;
        }
      };
      cdp.on("LayerTree.layerTreeDidChange", onLayers);
      try {
        await cdp.send("LayerTree.enable");
      } catch {
        // LayerTree is optional; an unavailable domain must not look like zero pressure.
      }

      await page.setViewport({
        deviceScaleFactor: viewport.dpr,
        hasTouch: viewport.label === "mobile",
        height: viewport.height,
        isMobile: viewport.label === "mobile",
        width: viewport.width,
      });

      await page.evaluateOnNewDocument(INPAGE_INIT_SCRIPT);

      onProgress?.(
        `Navigating to ${viewport.label} viewport (${viewport.width}x${viewport.height})...`
      );
      try {
        await page.goto(url, { timeout: 30_000, waitUntil: "load" });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        if (
          msg.includes("ERR_CONNECTION_REFUSED") ||
          msg.includes("ERR_NAME_NOT_RESOLVED")
        ) {
          throw new Error(`Failed to navigate to ${url}: ${msg}`, {
            cause: error,
          });
        }
        try {
          await page.goto(url, {
            timeout: 15_000,
            waitUntil: "domcontentloaded",
          });
        } catch (retryError: unknown) {
          const retryMsg =
            retryError instanceof Error
              ? retryError.message
              : String(retryError);
          throw new Error(`Failed to navigate to ${url}: ${retryMsg}`, {
            cause: retryError,
          });
        }
      }

      // Allow initial paint, React/Next.js hydration, and animations to mount
      await sleep(2500);

      // Capture full Chromium LayerTree snapshot from C++ Compositor across mount and scroll
      onProgress?.(
        `Capturing ${viewport.label} GPU compositor layer snapshot...`
      );

      // Allow initial paint and layer tree delivery
      await sleep(1500);
      const initialLayers = latestLayers.map((layer) => ({
        layerId: layer.layerId,
        paintCount: layer.paintCount,
      }));

      // Smooth scroll down and up to trigger scroll animations and runtime promotions
      onProgress?.(`Simulating scroll interaction on ${viewport.label}...`);
      // Everything recorded from here on is motion; everything before was load.
      const interactionStartMs = await page.evaluate(() => {
        const api = window.__MOTION_AUDIT__;
        return api?.markInteractionStart ? api.markInteractionStart() : null;
      });
      await page.evaluate(async () => {
        // oxlint-disable-next-line unicorn/consistent-function-scoping
        const delay = (ms: number) =>
          // oxlint-disable-next-line promise/avoid-new
          new Promise<void>((resolve) => {
            setTimeout(resolve, ms);
          });

        // ~1300px/s in both directions, inside the range a real wheel or trackpad flick
        // produces. The previous 3200px/s down and 10700px/s up self-inflicted
        // jank on every page and inflated the measured blocking budget.
        const distance = Math.min(document.body.scrollHeight, 2500);
        const step = 80;
        for (let y = 0; y <= distance; y += step) {
          window.scrollTo(0, y);
          // eslint-disable-next-line no-await-in-loop
          await delay(60);
        }
        for (let y = distance; y >= 0; y -= step * 2) {
          window.scrollTo(0, y);
          // eslint-disable-next-line no-await-in-loop
          await delay(120);
        }
      });

      // Allow compositor commits and layer changes to settle
      await sleep(500);
      cdp.off("LayerTree.layerTreeDidChange", onLayers);
      const capturedLayers = latestLayers;
      const initialLayerMap = new Map(
        initialLayers.map((layer) => [layer.layerId, layer])
      );
      const finalLayerMap = new Map(
        capturedLayers.map((layer) => [layer.layerId, layer])
      );
      const layerSnapshotDelta = {
        addedLayerCount: capturedLayers.filter(
          (layer) => !initialLayerMap.has(layer.layerId)
        ).length,
        afterCount: capturedLayers.length,
        beforeCount: initialLayers.length,
        changedPaintCount: capturedLayers.filter((layer) => {
          const initial = initialLayerMap.get(layer.layerId);
          return (
            initial !== undefined && initial.paintCount !== layer.paintCount
          );
        }).length,
        removedLayerCount: initialLayers.filter(
          (layer) => !finalLayerMap.has(layer.layerId)
        ).length,
      };

      const compositingReasons = await resolveLayerCompositingReasons(
        cdp,
        capturedLayers
      );
      const layerSelectors = await resolveAllLayerSelectors(
        cdp,
        capturedLayers,
        viewport,
        compositingReasons
      );

      // Extract runtime telemetry
      const telemetry = await page.evaluate((wildcard: string) => {
        const audit = window.__MOTION_AUDIT__;

        // The page script owns the selector format so animations and their frame
        // samples are described the same way on both sides.
        const getSelector = (target: Element | null): string =>
          target && audit?.getSelector ? audit.getSelector(target) : "div";

        // oxlint-disable-next-line unicorn/consistent-function-scoping
        const getElementOffscreen = (
          rect: {
            bottom: number;
            height: number;
            left: number;
            right: number;
            top: number;
            width: number;
          } | null,
          vpW: number,
          vpH: number
        ): boolean => {
          const buffer = 400;
          if (!rect) {
            return true;
          }
          const isVerticallyOffscreen =
            rect.bottom <= -buffer || rect.top >= vpH + buffer;
          const isHorizontallyOffscreen =
            rect.right <= -buffer || rect.left >= vpW + buffer;
          return isVerticallyOffscreen || isHorizontallyOffscreen;
        };

        // oxlint-disable-next-line unicorn/consistent-function-scoping
        const extractKeyframeProps = (
          effect: KeyframeEffect | null
        ): string[] => {
          const props: string[] = [];
          if (!effect?.getKeyframes) {
            return props;
          }
          const skipProps = new Set([
            "offset",
            "easing",
            "composite",
            "computedOffset",
          ]);
          for (const kf of effect.getKeyframes()) {
            for (const k of Object.keys(kf)) {
              if (!skipProps.has(k)) {
                props.push(k);
              }
            }
          }
          return props;
        };

        // oxlint-disable-next-line unicorn/consistent-function-scoping
        const detectLibs = (): string[] => {
          const libs: string[] = [];
          if (
            window.FramerMotion ||
            document.querySelector("[data-framer-name]")
          ) {
            libs.push("motion");
          }
          if (window.gsap || window.ScrollTrigger) {
            libs.push("gsap");
          }
          if (window.anime) {
            libs.push("anime");
          }
          if (window.lottie) {
            libs.push("lottie");
          }
          return libs;
        };

        const vpW =
          window.innerWidth || document.documentElement.clientWidth || 1000;
        const vpH =
          window.innerHeight || document.documentElement.clientHeight || 1000;

        // 1. WAAPI & CSS Animations
        interface PromotionInfo {
          hasWillChange: boolean;
          isPromoted: boolean;
        }

        // oxlint-disable-next-line unicorn/consistent-function-scoping
        const checkPromotion = (target: Element | null): PromotionInfo => {
          if (!target) {
            return { hasWillChange: false, isPromoted: false };
          }
          try {
            // Read through the page script's untracked wrappers: the audit's own
            // reads must not be recorded as the page's layout thrashing.
            const cs = audit?.getUntrackedStyle
              ? audit.getUntrackedStyle(target)
              : window.getComputedStyle(target);
            if (!cs) {
              return { hasWillChange: false, isPromoted: false };
            }
            const wc = cs.willChange || "";
            const hasWillChange = wc !== "" && wc !== "auto";
            const transform = cs.transform || "";
            const is3d =
              transform.includes("matrix3d") ||
              transform.includes("translate3d") ||
              transform.includes("translateZ");
            return { hasWillChange, isPromoted: hasWillChange || is3d };
          } catch {
            return { hasWillChange: false, isPromoted: false };
          }
        };

        // oxlint-disable-next-line unicorn/consistent-function-scoping
        const getUntrackedRect = (target: Element): DOMRect =>
          audit?.getUntrackedRect
            ? audit.getUntrackedRect(target)
            : target.getBoundingClientRect();

        const anims = document.getAnimations ? document.getAnimations() : [];
        const capturedAnims = anims.map((anim, idx) => {
          // SAFETY: WAAPI animation effect is expected to be KeyframeEffect
          const effect = anim.effect as KeyframeEffect | null;
          const target = effect?.target ?? null;
          const props = extractKeyframeProps(effect);
          const sel = getSelector(target);

          const timing = effect?.getTiming ? effect.getTiming() : null;
          const dur = Number.isFinite(timing?.duration)
            ? Number(timing?.duration)
            : 300;
          const iterations = Number.isFinite(timing?.iterations)
            ? Number(timing?.iterations)
            : 1;

          const rect = target
            ? getUntrackedRect(target)
            : {
                bottom: 100,
                height: 100,
                left: 0,
                right: 100,
                top: 0,
                width: 100,
              };

          const isOffscreen = getElementOffscreen(rect, vpW, vpH);
          const source: "css-animation" | "waapi" = anim.id?.startsWith("css")
            ? "css-animation"
            : "waapi";

          // A scroll()/view()-driven animation has no declared duration and is
          // re-sampled every scroll frame, so it must be attributed to the scroll
          // phase instead of being scored as a one-off timed transition.
          const timelineName = anim.timeline?.constructor?.name;
          const kind: AnimationKind =
            timelineName === "ScrollTimeline" || timelineName === "ViewTimeline"
              ? "scroll-linked"
              : "waapi";

          const { hasWillChange, isPromoted } = checkPromotion(target);

          const notes: string[] = [];
          if (!isPromoted) {
            notes.push("MISSING WILL-CHANGE");
          }

          return {
            durationMs: dur,
            hasWillChange,
            id: `anim-${idx}`,
            isOffscreen,
            isPromoted,
            iterations,
            kind,
            notes,
            paintArea: (rect.width || 100) * (rect.height || 100),
            properties: [...new Set(props)],
            selector: sel,
            source,
          };
        });

        // A finite animation detaches from document.getAnimations() once it
        // finishes. The one-shot enumerate above therefore misses every
        // short-lived animation; prefer the session-accumulated set when the
        // in-page hook provides it.
        const accumulatedWaapi = audit?.getAccumulatedWaapiAnimations
          ? audit.getAccumulatedWaapiAnimations()
          : [];
        const waapiCaptured =
          accumulatedWaapi.length > 0 ? accumulatedWaapi : capturedAnims;

        // 2. Inpage scroll, thrashing, and JS-driven animations
        const scrollData = audit?.getScrollData
          ? audit.getScrollData()
          : { hasLayoutOnScroll: false, listeners: [] };
        const scrollListeners = scrollData.listeners;
        const thrashingMutations = audit?.getThrashingData
          ? audit.getThrashingData()
          : [];
        const jsAnims = audit?.getJsAnimations ? audit.getJsAnimations() : [];
        const longAnimationFrames = audit?.getLongAnimationFrameData
          ? audit.getLongAnimationFrameData()
          : { entries: [], supported: false };
        const waapiAnimationFrames = audit?.getWaapiAnimationFrames
          ? audit.getWaapiAnimationFrames()
          : [];
        const scrollPhase = audit?.getScrollPhaseData
          ? audit.getScrollPhaseData()
          : {
              animationSampleCount: 0,
              scrollEventCount: 0,
              scrollFrameCount: 0,
              scrollLinkedAnimationCount: 0,
              scrollTriggeredCandidateCount: 0,
            };

        const sanitizeSelector = (sel: string): string =>
          (sel || "").replaceAll(/:nth-child\(\d+\)/gu, wildcard);

        // Deduplicate JS animations if already managed by WAAPI on the same element.
        // Must use waapiCaptured, not the one-shot enumerate, otherwise JS
        // animations duplicating a short-lived WAAPI animation slip through.
        const waapiKeys = new Set(
          waapiCaptured.flatMap((a) =>
            a.properties.map(
              (p) => `${sanitizeSelector(a.selector)}:${p.toLowerCase()}`
            )
          )
        );
        const filteredJsAnims = jsAnims.filter((ja) => {
          const norm = sanitizeSelector(ja.selector);
          return !ja.properties.every((p) =>
            waapiKeys.has(`${norm}:${p.toLowerCase()}`)
          );
        });

        const libs = detectLibs();

        return {
          animations: [...waapiCaptured, ...filteredJsAnims],
          hasLayoutOnScroll: scrollData.hasLayoutOnScroll,
          libs,
          longAnimationFrames,
          scrollListeners,
          scrollPhase,
          thrashingBreakdown: audit?.getThrashingBreakdown?.(),
          thrashingMutations,
          waapiAnimationFrames,
        };
      }, NTH_CHILD_WILDCARD);

      // Process GPU / CDP Layers
      const viewportArea = viewport.width * viewport.height;
      let totalTextureVram = 0;
      let totalTiledVram = 0;
      let textureCount = 0;

      const processedLayers: CdpLayer[] = capturedLayers.map((raw) => {
        // Chromium cc::TileManager divides layers exceeding screen dimensions into 256x256 tiles
        const isTiled =
          Boolean(raw.scrollRects && raw.scrollRects.length > 0) ||
          raw.height > viewport.height ||
          raw.width > viewport.width ||
          raw.width * raw.height > viewportArea * 1.2;

        const layerKind = determineLayerKind(raw.drawsContent, isTiled);

        let vram = 0;
        if (layerKind === "content_raster") {
          vram = calculateRawTextureMemory(raw.width, raw.height, viewport.dpr);
          totalTextureVram += vram;
          textureCount += 1;
        } else if (layerKind === "tiled_scroller") {
          // Tiled layer memory is bounded by visible viewport + Chromium pre-raster horizon (up to 2x viewport)
          const rasterWidth = Math.min(raw.width, viewport.width);
          const rasterHeight = Math.min(raw.height, viewport.height * 2);
          vram = calculateTiledLayerMemory(
            rasterWidth,
            rasterHeight,
            viewport.dpr
          );
          totalTiledVram += vram;
        }

        const isOverlap =
          hasCompositingReason(compositingReasons.get(raw.layerId) ?? [], [
            "overlap",
          ]) &&
          !hasCompositingReason(compositingReasons.get(raw.layerId) ?? [], [
            "willchange",
            "will-change",
            "transform",
            "translate",
            "rotate",
            "scale",
            "opacity",
          ]);

        const isWillChange = hasCompositingReason(
          compositingReasons.get(raw.layerId) ?? [],
          ["willchange", "will-change"]
        );

        const notes: ("TILED" | "OVERLAP" | "WILL-CHANGE")[] = [];
        if (layerKind === "tiled_scroller") {
          notes.push("TILED");
        }
        if (isOverlap) {
          notes.push("OVERLAP");
        }
        if (isWillChange) {
          notes.push("WILL-CHANGE");
        }

        let layerTier: Tier = "S";
        if (vram > 40 * 1024 * 1024) {
          layerTier = "F";
        } else if (vram > 20 * 1024 * 1024) {
          layerTier = "D";
        } else if (vram > 10 * 1024 * 1024) {
          layerTier = "A";
        }

        return {
          backendNodeId: raw.backendNodeId,
          compositedVramBytes: vram,
          compositingReasons: compositingReasons.get(raw.layerId) ?? [],
          drawsContent: raw.drawsContent,
          height: raw.height,
          isOverlapPromoted: isOverlap,
          isWillChangePromoted: isWillChange,
          layerId: raw.layerId,
          layerKind,
          notes,
          offsetX: raw.offsetX,
          offsetY: raw.offsetY,
          paintCount: raw.paintCount,
          selector: layerSelectors.get(raw.layerId) || "<layer>",
          tier: layerTier,
          width: raw.width,
        };
      });

      // 1. GPU Score
      const gpuEval = evaluateGpuResourcePressure({
        compositedVramBytes: totalTextureVram,
        deviceContext: viewport.label,
        layerCount: textureCount,
        measurementAvailable: latestLayers.length > 0,
        tiledBackingBytes: totalTiledVram,
      });

      // 2. Animations Score
      const { animationsScore, scoredAnims } = evaluateScoredAnimations(
        telemetry.animations,
        telemetry.waapiAnimationFrames,
        viewportArea
      );

      // 3. Scroll Score
      const scrollCount = telemetry.scrollListeners.length;
      const usesPassive = telemetry.scrollListeners.every((l) => l.passive);
      const usesRaf = telemetry.scrollListeners.every(
        (l) => l.hasRafOrDebounce
      );
      const nonPassiveCount = telemetry.scrollListeners.filter(
        (l) => !l.passive
      ).length;
      const unoptimizedCount = telemetry.scrollListeners.filter(
        (l) => !l.hasRafOrDebounce
      ).length;
      const { hasLayoutOnScroll } = telemetry;
      const scrollDrivenAnimations = scoredAnims.filter(
        (a) => a.kind === "scroll-linked" || a.kind === "scroll-triggered"
      );
      const scrollPenalty = calculateScrollBehaviorPenalty({
        hasLayoutOnScroll,
        listenerCount: scrollCount,
        nonPassiveCount,
        scrollDrivenAnimationPenalty: calculateScrollDrivenAnimationPenalty(
          scrollDrivenAnimations,
          viewportArea
        ),
        unoptimizedCount,
      });
      const scrollScore = Math.max(0, 100 - scrollPenalty);

      // 4. Thrashing Score
      const violations: ThrashViolation[] = telemetry.thrashingMutations.map(
        (m: InpageThrashingRecord) => ({
          api: m.property,
          frame: m.frameIndex,
          phase: m.phase || "frame",
          readSelector: m.selector,
          type:
            m.type === "style" || m.property === "getComputedStyle"
              ? "style"
              : "layout",
          writeSelector: m.selector,
        })
      );
      const thrashAnalysis = analyzeLayoutThrashing(violations);
      const thrashingScore = thrashAnalysis.score;

      let maxDurationMs = 0;
      let totalDurationMs = 0;
      let totalBlockingDurationMs = 0;
      let interactionBlockingMs = 0;
      for (const entry of telemetry.longAnimationFrames.entries) {
        if (entry.duration > maxDurationMs) {
          maxDurationMs = entry.duration;
        }
        totalDurationMs += entry.duration;
        totalBlockingDurationMs += entry.blockingDuration;
        if (
          interactionStartMs !== null &&
          entry.startTime >= interactionStartMs
        ) {
          interactionBlockingMs += entry.blockingDuration;
        }
      }

      // An unmarked run cannot be split, so fall back to the whole-run total
      // rather than silently reporting zero motion blocking.
      const interactionMs =
        interactionStartMs === null
          ? totalBlockingDurationMs
          : interactionBlockingMs;

      const longAnimationFrameTelemetry: LongAnimationFrameTelemetry = {
        entryCount: telemetry.longAnimationFrames.entries.length,
        interactionBlockingMs: interactionMs,
        interactionStartMs,
        loadBlockingMs:
          interactionStartMs === null
            ? 0
            : totalBlockingDurationMs - interactionMs,
        maxDurationMs,
        supported: telemetry.longAnimationFrames.supported,
        totalBlockingDurationMs,
        totalDurationMs,
      };

      // Composite Viewport Score
      const viewportScoreResult = computeViewportScore({
        animations: {
          score: animationsScore,
          tier: tierFromScore(animationsScore),
        },
        gpuPressure: { score: gpuEval.score, tier: gpuEval.tier },
        scrollAnimations: {
          score: scrollScore,
          tier: tierFromScore(scrollScore),
        },
        thrashing: {
          score: thrashingScore,
          tier: tierFromScore(thrashingScore),
        },
      });

      const scrollLinkedCount =
        telemetry.scrollPhase?.scrollLinkedAnimationCount ??
        scoredAnims.filter((a) => a.kind === "scroll-linked").length;
      const scrollTriggeredCount = scoredAnims.filter(
        (a) => a.kind === "scroll-triggered"
      ).length;
      const waapiCount = scoredAnims.filter(
        (a) => a.kind === "waapi" || a.source === "waapi"
      ).length;
      const jsCount = scoredAnims.filter(
        (a) => a.kind === "javascript" || a.source === "js-loop"
      ).length;

      return {
        animationFrameSamples: telemetry.waapiAnimationFrames,
        animations: scoredAnims,
        animationsScore,
        animationsTier: tierFromScore(animationsScore),
        frameTiming: evaluateMeasuredFrameTiming(longAnimationFrameTelemetry),
        gpuScore: gpuEval.score,
        gpuTier: gpuEval.tier,
        layerCount: processedLayers.filter((l) => l.drawsContent).length,
        layerSnapshotDelta,
        layers: processedLayers,
        longAnimationFrames: longAnimationFrameTelemetry,
        measured: true,
        overallScore: viewportScoreResult.score,
        overallTier: viewportScoreResult.tier,
        scroll: {
          hasLayoutOnScroll,
          jsCount,
          listenerCount: scrollCount,
          scrollLinkedCount,
          scrollTriggeredCount,
          selectors: telemetry.scrollListeners.map((l) => l.selector),
          usesPassive,
          usesRafOrDebounce: usesRaf,
          waapiCount,
        },
        scrollPhase: telemetry.scrollPhase,
        scrollScore,
        scrollTier: tierFromScore(scrollScore),
        textureVramBytes: totalTextureVram,
        thrashingBreakdown: telemetry.thrashingBreakdown,
        thrashingScore,
        thrashingTier: tierFromScore(thrashingScore),
        tiledVramBytes: totalTiledVram,
        viewport,
        vramBytes: totalTextureVram + totalTiledVram,
      };
    } finally {
      await page.close().catch(noopHandler);
    }
  };

  close = async (): Promise<void> => {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  };
}
