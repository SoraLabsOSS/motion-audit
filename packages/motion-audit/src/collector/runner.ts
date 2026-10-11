import { setTimeout as sleep } from "node:timers/promises";

import type { Browser } from "puppeteer";
import { connect, launch } from "puppeteer";

import { computeEffectiveConcurrency } from "../math/concurrency.js";
import {
  calculateAnimationDurationMultiplier,
  calculateOffscreenPenaltyMultiplier,
  calculatePaintAreaMultiplier,
  calculateScrollBehaviorPenalty,
  getMaxPropertyCost,
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
  AnimationSource,
  CapturedAnimation,
  CdpLayer,
  LongAnimationFrameTelemetry,
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
  getJsAnimations: () => {
    id: string;
    selector: string;
    properties: string[];
    source: AnimationSource;
    durationMs: number;
    iterations?: number;
    paintArea: number;
    isOffscreen?: boolean;
  }[];
  getLongAnimationFrameData: () => {
    supported: boolean;
    entries: { duration: number; blockingDuration: number }[];
  };
  getWaapiAnimationFrames: () => AnimationFrameSample[];
  getScrollPhaseData: () => {
    scrollEventCount: number;
    scrollFrameCount: number;
    animationSampleCount: number;
    scrollLinkedAnimationCount: number;
    scrollTriggeredCandidateCount: number;
  };
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

    if (process.env.MOTION_AUDIT_NO_SANDBOX || process.env.CI) {
      launchArgs.push("--no-sandbox", "--disable-setuid-sandbox");
    }

    this.browser = await launch({
      args: launchArgs,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: true,
    });
    return this.browser;
  };

  auditViewport = async (
    url: string,
    viewport: ViewportConfig,
    onProgress?: (msg: string) => void
  ): Promise<ViewportAuditResult> => {
    const browser = this.browser ?? (await this.launch(onProgress));
    const page = await browser.newPage();
    const cdp = await page.createCDPSession();

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
          retryError instanceof Error ? retryError.message : String(retryError);
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
    let latestLayers: RawCdpLayer[] = [];
    let hasCapturedLayers = false;

    const onLayers = (params: { layers?: RawCdpLayer[] }) => {
      if (params.layers && params.layers.length > 0) {
        latestLayers = params.layers;
        hasCapturedLayers = true;
      }
    };
    cdp.on("LayerTree.layerTreeDidChange", onLayers);
    try {
      await cdp.send("LayerTree.enable");
    } catch {
      // Best-effort enable; ignored if LayerTree domain is already active
    }

    // Allow initial paint and layer tree delivery
    await sleep(1500);
    const initialLayers = latestLayers.map((layer) => ({
      layerId: layer.layerId,
      paintCount: layer.paintCount,
    }));

    // Smooth scroll down and up to trigger scroll animations and runtime promotions
    onProgress?.(`Simulating scroll interaction on ${viewport.label}...`);
    await page.evaluate(async () => {
      // oxlint-disable-next-line unicorn/consistent-function-scoping
      const delay = (ms: number) =>
        // oxlint-disable-next-line promise/avoid-new
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms);
        });

      const distance = Math.min(document.body.scrollHeight, 2500);
      const step = 80;
      for (let y = 0; y <= distance; y += step) {
        window.scrollTo(0, y);
        // eslint-disable-next-line no-await-in-loop
        await delay(25);
      }
      for (let y = distance; y >= 0; y -= step * 2) {
        window.scrollTo(0, y);
        // eslint-disable-next-line no-await-in-loop
        await delay(15);
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
        return initial !== undefined && initial.paintCount !== layer.paintCount;
      }).length,
      removedLayerCount: initialLayers.filter(
        (layer) => !finalLayerMap.has(layer.layerId)
      ).length,
    };

    const compositingReasons = new Map<string, string[]>();
    const reasonPromises = capturedLayers.map(async (layer) => {
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
    const reasonEntries = await Promise.all(reasonPromises);
    for (const [id, reasons] of reasonEntries) {
      compositingReasons.set(id, reasons);
    }

    // Extract runtime telemetry
    const telemetry = await page.evaluate((wildcard: string) => {
      // oxlint-disable-next-line unicorn/consistent-function-scoping
      const getSelector = (target: Element | null): string => {
        if (!target) {
          return "div";
        }
        if (target.id) {
          return `#${target.id}`;
        }
        const classAttr = target.getAttribute("class");
        if (classAttr) {
          const [firstClass] = classAttr.trim().split(/\s+/u);
          if (firstClass) {
            return `${target.tagName.toLowerCase()}.${firstClass}`;
          }
        }
        return target.tagName.toLowerCase();
      };

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

        const rect = target?.getBoundingClientRect
          ? target.getBoundingClientRect()
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

        return {
          durationMs: dur,
          id: `anim-${idx}`,
          isOffscreen,
          iterations,
          paintArea: (rect.width || 100) * (rect.height || 100),
          properties: [...new Set(props)],
          selector: sel,
          source,
        };
      });

      // 2. Inpage scroll, thrashing, and JS-driven animations
      const audit = window.__MOTION_AUDIT__;
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

      // Deduplicate JS animations if already managed by WAAPI on the same element
      const waapiKeys = new Set(
        capturedAnims.flatMap((a) =>
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
        animations: [...capturedAnims, ...filteredJsAnims],
        hasLayoutOnScroll: scrollData.hasLayoutOnScroll,
        libs,
        longAnimationFrames,
        scrollListeners,
        scrollPhase,
        thrashingMutations,
        waapiAnimationFrames,
      };
    }, NTH_CHILD_WILDCARD);

    await page.close();

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
        textureCount += 1;
      }

      return {
        backendNodeId: raw.backendNodeId,
        compositedVramBytes: vram,
        compositingReasons: compositingReasons.get(raw.layerId) ?? [],
        drawsContent: raw.drawsContent,
        height: raw.height,
        isOverlapPromoted:
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
          ]),
        isWillChangePromoted: hasCompositingReason(
          compositingReasons.get(raw.layerId) ?? [],
          ["willchange", "will-change"]
        ),
        layerId: raw.layerId,
        layerKind,
        offsetX: raw.offsetX,
        offsetY: raw.offsetY,
        paintCount: raw.paintCount,
        width: raw.width,
      };
    });

    // 1. GPU Score
    const gpuEval = evaluateGpuResourcePressure({
      compositedVramBytes: totalTextureVram,
      deviceContext: viewport.label,
      layerCount: textureCount,
      measurementAvailable: hasCapturedLayers,
      tiledBackingBytes: totalTiledVram,
    });

    // 2. Animations Score
    const animRawScores: number[] = [];
    const animationsWithFrames = telemetry.animations.map((animation) => {
      const norm = normalizeSelectorWildcard(animation.selector);
      const match = telemetry.waapiAnimationFrames.find((sample) => {
        const sampleNorm = normalizeSelectorWildcard(sample.selector);
        return (
          (sampleNorm === norm || sampleNorm.endsWith(` > ${norm}`)) &&
          sample.properties.some((property) =>
            animation.properties.includes(property)
          )
        );
      });
      return match ? { ...animation, frames: match.frames } : animation;
    });
    const dedupedTelemetryAnims = animationsWithFrames.filter((a, idx, arr) => {
      const norm = normalizeSelectorWildcard(a.selector);
      const aProps = a.properties.toSorted().join(",");
      const firstIdx = arr.findIndex((item) => {
        const itemNorm = normalizeSelectorWildcard(item.selector);
        return (
          itemNorm === norm &&
          item.source === a.source &&
          item.properties.toSorted().join(",") === aProps
        );
      });
      return firstIdx === idx;
    });

    const scoredAnims: CapturedAnimation[] = (
      dedupedTelemetryAnims.length > 0
        ? dedupedTelemetryAnims
        : animationsWithFrames
    ).map((a) => {
      const maxCost = getMaxPropertyCost(a.properties);
      const areaMult = calculatePaintAreaMultiplier(a.paintArea, viewportArea);
      const durDiscount = calculateAnimationDurationMultiplier(
        a.durationMs,
        a.iterations
      );
      const offscreenMult = calculateOffscreenPenaltyMultiplier(
        a.isOffscreen,
        maxCost
      );
      const rawPenalty = maxCost * areaMult * durDiscount * offscreenMult;
      // Cap single animation penalty at 75 to keep a sane lower bound (min score 25)
      const penalty = Math.min(75, rawPenalty);
      const score = Math.max(0, Math.round(100 - penalty));
      animRawScores.push(score);
      return {
        ...a,
        tier: tierFromScore(score),
      };
    });

    const activeConcurrency =
      scoredAnims.length > 0
        ? computeEffectiveConcurrency(
            scoredAnims.map((a) => ({ frames: a.frames ?? [0] }))
          ).effectiveConcurrent
        : 0;

    const animEval = aggregateAnimationScores(animRawScores);
    // Moderate concurrency deduction: only penalize when sustained active concurrency exceeds 4
    const concurrencyDeduction =
      activeConcurrency > 4
        ? Math.min(12, Math.round((activeConcurrency - 4) * 1.5))
        : 0;
    const animationsScore = Math.max(
      0,
      Math.min(100, animEval.score - concurrencyDeduction)
    );

    // 3. Scroll Score
    const scrollCount = telemetry.scrollListeners.length;
    const usesPassive = telemetry.scrollListeners.every((l) => l.passive);
    const usesRaf = telemetry.scrollListeners.every((l) => l.hasRafOrDebounce);
    const nonPassiveCount = telemetry.scrollListeners.filter(
      (l) => !l.passive
    ).length;
    const unoptimizedCount = telemetry.scrollListeners.filter(
      (l) => !l.hasRafOrDebounce
    ).length;
    const { hasLayoutOnScroll } = telemetry;
    const scrollPenalty = calculateScrollBehaviorPenalty({
      hasLayoutOnScroll,
      listenerCount: scrollCount,
      nonPassiveCount,
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
    for (const entry of telemetry.longAnimationFrames.entries) {
      if (entry.duration > maxDurationMs) {
        maxDurationMs = entry.duration;
      }
      totalDurationMs += entry.duration;
      totalBlockingDurationMs += entry.blockingDuration;
    }

    const longAnimationFrameTelemetry: LongAnimationFrameTelemetry = {
      entryCount: telemetry.longAnimationFrames.entries.length,
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
      thrashing: { score: thrashingScore, tier: tierFromScore(thrashingScore) },
    });

    return {
      animationFrameSamples: telemetry.waapiAnimationFrames,
      animations: scoredAnims,
      animationsScore,
      animationsTier: tierFromScore(animationsScore),
      gpuScore: gpuEval.score,
      gpuTier: gpuEval.tier,
      layerCount: processedLayers.filter((l) => l.drawsContent).length,
      layerSnapshotDelta,
      layers: processedLayers,
      longAnimationFrames: longAnimationFrameTelemetry,
      overallScore: viewportScoreResult.score,
      overallTier: viewportScoreResult.tier,
      scroll: {
        hasLayoutOnScroll,
        listenerCount: scrollCount,
        selectors: telemetry.scrollListeners.map((l) => l.selector),
        usesPassive,
        usesRafOrDebounce: usesRaf,
      },
      scrollPhase: telemetry.scrollPhase,
      scrollScore,
      scrollTier: tierFromScore(scrollScore),
      thrashingScore,
      thrashingTier: tierFromScore(thrashingScore),
      viewport,
      vramBytes: totalTextureVram + totalTiledVram,
    };
  };

  close = async (): Promise<void> => {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  };
}
