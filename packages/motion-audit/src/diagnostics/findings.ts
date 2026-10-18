import { classifyPropertyStage } from "../math/scaling.js";
import type { AuditFinding, ViewportAuditResult } from "../types.js";
import {
  generateIncidentRemediationPrompt,
  generateLayoutRefactorPrompt,
} from "./ai-prompt.js";

const LAYOUT_PROPERTIES = new Set([
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  "margin",
  "padding",
  "flex",
  "grid",
]);

const collectGpuFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => {
  const findings: AuditFinding[] = [];

  // 128MB (Tier B threshold)
  if (
    desktop.measured !== false &&
    desktop.gpuTier !== "S" &&
    desktop.vramBytes > 128 * 1024 * 1024
  ) {
    const mb = Math.round(desktop.vramBytes / (1024 * 1024));
    findings.push({
      category: "gpu",
      description: `Desktop viewport allocates ~${mb}MB of raw texture memory. Excessive texture memory can cause GPU context thrashing and browser tab crashes on low-spec hardware.`,
      fixPrompt: generateIncidentRemediationPrompt(
        url,
        `Desktop VRAM is ~${mb}MB across ${desktop.layerCount} composited layers.`,
        "Audit DOM elements promoted to layers and eliminate unnecessary hardware acceleration."
      ),
      id: "gpu-vram-desktop",
      recommendation:
        "Reduce the number of promoted compositor layers. Consolidate overlapping layers and remove unnecessary `will-change: transform`.",
      severity: desktop.vramBytes > 256 * 1024 * 1024 ? "critical" : "high",
      title: "High GPU Composited VRAM Usage (Desktop)",
      viewport: "desktop",
    });
  }

  // 64MB (Tier B threshold)
  if (
    mobile.measured !== false &&
    mobile.gpuTier !== "S" &&
    mobile.vramBytes > 64 * 1024 * 1024
  ) {
    const mb = Math.round(mobile.vramBytes / (1024 * 1024));
    findings.push({
      category: "gpu",
      description: `Mobile Retina (DPR 3) allocates ~${mb}MB of texture surfaces. On mobile devices sharing unified system RAM, exceeding budget risks iOS WebKit Jetsam termination.`,
      fixPrompt: generateIncidentRemediationPrompt(
        url,
        `Mobile VRAM is ~${mb}MB on DPR 3 display.`,
        "Remove will-change on mobile screens and keep promoted layers below 15."
      ),
      id: "gpu-vram-mobile",
      recommendation:
        "Optimize mobile DOM depth. Avoid promoting background containers to individual GPU layers on mobile viewports.",
      severity: mobile.vramBytes > 128 * 1024 * 1024 ? "critical" : "high",
      title: "Mobile Texture Memory Exceeds Safe Budget",
      viewport: "mobile",
    });
  }

  return findings;
};

const collectLayoutAnimationFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => {
  const allAnims = [
    ...(desktop.measured === false ? [] : desktop.animations),
    ...(mobile.measured === false ? [] : mobile.animations),
  ];
  const layoutAnims = allAnims.filter((a) =>
    a.properties.some((p) => LAYOUT_PROPERTIES.has(p))
  );

  if (layoutAnims.length === 0) {
    return [];
  }

  const selectors = [...new Set(layoutAnims.map((a) => a.selector))];
  const animatedProps = [
    ...new Set(layoutAnims.flatMap((a) => a.properties)),
  ].join(", ");

  return [
    {
      category: "layout-animation",
      description: `Found ${layoutAnims.length} animation(s) modifying geometric layout properties (${animatedProps}). This invalidates the layout tree on every single animation tick.`,
      fixPrompt: generateLayoutRefactorPrompt(
        url,
        `Animations on ${selectors.join(", ")} are altering geometric layout properties on active frame ticks.`,
        selectors
      ),
      id: "anim-layout-props",
      recommendation:
        "Replace size animations (width/height) with `transform: scale()` and coordinate animations (top/left) with `transform: translate3d()`.",
      selectors,
      severity: "critical",
      title: "Animations Triggering Synchronous Layout (Reflow)",
      viewport: "both",
    },
  ];
};

const resolveScrollFindingViewport = (
  nonPassiveDesktop: boolean,
  nonPassiveMobile: boolean
): "both" | "desktop" | "mobile" => {
  if (nonPassiveDesktop && nonPassiveMobile) {
    return "both";
  }
  if (nonPassiveDesktop) {
    return "desktop";
  }
  return "mobile";
};

const collectScrollFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => {
  const nonPassiveDesktop =
    desktop.measured !== false &&
    desktop.scroll.listenerCount > 0 &&
    !desktop.scroll.usesPassive;
  const nonPassiveMobile =
    mobile.measured !== false &&
    mobile.scroll.listenerCount > 0 &&
    !mobile.scroll.usesPassive;
  const hasLayoutOnScroll =
    (desktop.measured !== false && desktop.scroll.hasLayoutOnScroll) ||
    (mobile.measured !== false && mobile.scroll.hasLayoutOnScroll);

  if (!nonPassiveDesktop && !nonPassiveMobile && !hasLayoutOnScroll) {
    return [];
  }

  const affected = [
    ...new Set([
      ...(desktop.measured === false ? [] : desktop.scroll.selectors),
      ...(mobile.measured === false ? [] : mobile.scroll.selectors),
    ]),
  ];

  return [
    {
      category: "scroll",
      description: hasLayoutOnScroll
        ? "Scroll listeners are forcing synchronous DOM layout invalidation on active scroll ticks, dropping frames and causing scroll stutter."
        : "Scroll listeners attached without `{ passive: true }`. Use passive listeners where handlers do not call preventDefault so scrolling is less likely to be blocked by main-thread work.",
      fixPrompt: generateIncidentRemediationPrompt(
        url,
        hasLayoutOnScroll
          ? "Scroll event listeners are forcing synchronous layout queries."
          : "Scroll event listeners are synchronous and missing the passive flag.",
        "Add { passive: true } to all scroll event listeners or convert to IntersectionObserver.",
        affected
      ),
      id: "scroll-non-passive",
      recommendation:
        'Pass `{ passive: true }` in `addEventListener("scroll", handler, { passive: true })` or migrate to CSS `scroll-timeline` / `IntersectionObserver`.',
      selectors: affected,
      severity: hasLayoutOnScroll ? "high" : "low",
      title: hasLayoutOnScroll
        ? "Scroll Handlers Triggering Synchronous Layout"
        : "Synchronous Non-Passive Scroll Event Listeners",
      viewport: resolveScrollFindingViewport(
        nonPassiveDesktop,
        nonPassiveMobile
      ),
    },
  ];
};

const collectThrashingAndOffscreenFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => {
  const findings: AuditFinding[] = [];

  const deskThrashing =
    desktop.measured !== false && desktop.thrashingScore < 80;
  const mobThrashing = mobile.measured !== false && mobile.thrashingScore < 80;

  if (deskThrashing || mobThrashing) {
    let thrashingViewport: "desktop" | "mobile" = "mobile";
    if (deskThrashing && mobThrashing) {
      thrashingViewport =
        desktop.thrashingScore < mobile.thrashingScore ? "desktop" : "mobile";
    } else if (deskThrashing) {
      thrashingViewport = "desktop";
    }

    findings.push({
      category: "thrashing",
      description:
        "Interleaved DOM reads (e.g. `offsetHeight`, `getBoundingClientRect`) immediately following DOM writes defeat browser style-batching and force synchronous reflows.",
      fixPrompt: generateIncidentRemediationPrompt(
        url,
        "Continuous read-after-write mutations are forcing layout flushes inside requestAnimationFrame loops.",
        "Separate measurements from style mutations. Read all geometry before writing new styles."
      ),
      id: "layout-thrashing",
      recommendation:
        "Batch all DOM reads first, then execute DOM writes (e.g., FastDOM or `requestAnimationFrame`).",
      severity: "critical",
      title: "Consecutive DOM Layout Thrashing Detected",
      viewport: thrashingViewport,
    });
  }

  const allAnims = [
    ...(desktop.measured === false ? [] : desktop.animations),
    ...(mobile.measured === false ? [] : mobile.animations),
  ];
  const offscreenMutations = allAnims.filter(
    (a) =>
      a.isOffscreen &&
      (a.source === "js-loop" ||
        a.properties.some(
          (p) =>
            LAYOUT_PROPERTIES.has(p) ||
            p.startsWith("background") ||
            p.endsWith("color")
        ))
  );

  if (offscreenMutations.length > 0) {
    const selectors = [...new Set(offscreenMutations.map((a) => a.selector))];
    findings.push({
      category: "offscreen-animation",
      description: `Detected ${offscreenMutations.length} animation(s) running outside the viewport while modifying layout or paint properties. This burns CPU/battery without user benefit.`,
      fixPrompt: generateIncidentRemediationPrompt(
        url,
        `Offscreen animations on ${selectors.join(", ")} are continuously triggering reflow/repaint passes.`,
        "Pause offscreen animations with IntersectionObserver or content-visibility: auto."
      ),
      id: "anim-offscreen-mutation",
      recommendation:
        "Throttle or pause animations outside the viewport using `IntersectionObserver`, `content-visibility: auto`, or `animation-play-state: paused`.",
      selectors,
      severity: "high",
      title: "Active Offscreen Animations Invalidating Main Thread",
      viewport: "both",
    });
  }

  return findings;
};

const collectOverlapFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  const checkViewport = (
    vp: ViewportAuditResult,
    label: "desktop" | "mobile"
  ) => {
    const overlapLayers = vp.layers.filter((l) => l.isOverlapPromoted);
    if (overlapLayers.length >= 3) {
      const selectors = overlapLayers
        .map((l) => l.selector)
        .filter((s): s is string => Boolean(s && !s.startsWith("<")));
      findings.push({
        category: "overlap",
        description: `${overlapLayers.length} elements are compositor layers only because they overlap other composited content. The browser promotes overlapping elements to separate GPU layers to preserve correct paint order, which increases memory usage.`,
        fixPrompt: generateIncidentRemediationPrompt(
          url,
          `${overlapLayers.length} layers are overlap-promoted on ${label}.`,
          "Ensure animated elements don't unnecessarily overlap other composited content. Use `contain: layout` or adjust stacking contexts.",
          selectors
        ),
        id: `overlap-promoted-${label}`,
        recommendation:
          "Audit affected elements for reasons they might be promoted to layers unnecessarily. Ensure animated elements do not overlap large static backgrounds.",
        selectors,
        severity: overlapLayers.length > 8 ? "high" : "low",
        title: "Overlap-Promoted Layers",
        viewport: label,
      });
    }
  };

  if (desktop.measured !== false) {
    checkViewport(desktop, "desktop");
  }
  if (mobile.measured !== false) {
    checkViewport(mobile, "mobile");
  }
  return findings;
};

const collectWillChangeFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  const allAnims = [
    ...(desktop.measured === false ? [] : desktop.animations),
    ...(mobile.measured === false ? [] : mobile.animations),
  ];
  const missingWcAnims = allAnims.filter(
    (a) =>
      a.notes?.includes("MISSING WILL-CHANGE") &&
      // Only compositor properties benefit from a promotion hint; a
      // width/height animation needs transform, not will-change.
      a.properties.some((p) => classifyPropertyStage(p) === "compositor")
  );

  if (missingWcAnims.length > 0) {
    const selectors = [...new Set(missingWcAnims.map((a) => a.selector))];
    findings.push({
      category: "will-change",
      description: `${missingWcAnims.length} animations run transform/opacity without a will-change or 3D transform hint. Chrome usually promotes these on its own, so treat this as informational and only act when a performance profile shows the promotion is missing.`,
      fixPrompt: generateIncidentRemediationPrompt(
        url,
        `${missingWcAnims.length} animations are missing layer promotion hints on ${selectors.join(", ")}.`,
        "Optimize compositor layer lifecycle; promote during animation and remove when idle.",
        selectors
      ),
      id: "anim-missing-will-change",
      recommendation:
        "Promote elements during active animation and release when idle to avoid unnecessary memory overhead.",
      selectors,
      severity: "low",
      title: "Missing `will-change` on Compositor Animation",
      viewport: "both",
    });
  }

  return findings;
};

const collectExcessScrollListenerFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => {
  const findings: AuditFinding[] = [];
  const checkVp = (vp: ViewportAuditResult, label: "desktop" | "mobile") => {
    const totalAnims =
      (vp.scroll.scrollLinkedCount || 0) +
      (vp.scroll.scrollTriggeredCount || 0);
    if (
      vp.scroll.listenerCount >= 4 &&
      totalAnims > 0 &&
      vp.scroll.listenerCount > totalAnims * 2
    ) {
      findings.push({
        category: "scroll",
        description: `${vp.scroll.listenerCount} scroll listeners detected for ${totalAnims} scroll animations. Each listener adds overhead to every scroll event.`,
        fixPrompt: generateIncidentRemediationPrompt(
          url,
          `${vp.scroll.listenerCount} scroll listeners active for only ${totalAnims} scroll animations.`,
          "Consolidate multiple scroll listeners into a single passive listener or migrate to IntersectionObserver."
        ),
        id: `scroll-excess-listeners-${label}`,
        recommendation:
          "Consolidate multiple scroll listeners into a single shared handler, or replace with `IntersectionObserver`.",
        severity: "high",
        title: "Excess Scroll Event Listeners",
        viewport: label,
      });
    }
  };

  if (desktop.measured !== false) {
    checkVp(desktop, "desktop");
  }
  if (mobile.measured !== false) {
    checkVp(mobile, "mobile");
  }
  return findings;
};

export const generateAuditFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => [
  ...collectGpuFindings(url, desktop, mobile),
  ...collectOverlapFindings(url, desktop, mobile),
  ...collectLayoutAnimationFindings(url, desktop, mobile),
  ...collectWillChangeFindings(url, desktop, mobile),
  ...collectScrollFindings(url, desktop, mobile),
  ...collectExcessScrollListenerFindings(url, desktop, mobile),
  ...collectThrashingAndOffscreenFindings(url, desktop, mobile),
];
