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
  if (desktop.gpuTier !== "S" && desktop.vramBytes > 128 * 1024 * 1024) {
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
  if (mobile.gpuTier !== "S" && mobile.vramBytes > 64 * 1024 * 1024) {
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
  const allAnims = [...desktop.animations, ...mobile.animations];
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
    desktop.scroll.listenerCount > 0 && !desktop.scroll.usesPassive;
  const nonPassiveMobile =
    mobile.scroll.listenerCount > 0 && !mobile.scroll.usesPassive;
  const hasLayoutOnScroll =
    desktop.scroll.hasLayoutOnScroll || mobile.scroll.hasLayoutOnScroll;

  if (!nonPassiveDesktop && !nonPassiveMobile && !hasLayoutOnScroll) {
    return [];
  }

  const affected = [
    ...new Set([...desktop.scroll.selectors, ...mobile.scroll.selectors]),
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

  if (desktop.thrashingScore < 80 || mobile.thrashingScore < 80) {
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
      viewport:
        desktop.thrashingScore < mobile.thrashingScore ? "desktop" : "mobile",
    });
  }

  const allAnims = [...desktop.animations, ...mobile.animations];
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

export const generateAuditFindings = (
  url: string,
  desktop: ViewportAuditResult,
  mobile: ViewportAuditResult
): AuditFinding[] => [
  ...collectGpuFindings(url, desktop, mobile),
  ...collectLayoutAnimationFindings(url, desktop, mobile),
  ...collectScrollFindings(url, desktop, mobile),
  ...collectThrashingAndOffscreenFindings(url, desktop, mobile),
];
