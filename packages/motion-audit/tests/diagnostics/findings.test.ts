import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { generateAuditFindings } from "../../src/diagnostics/findings.js";
import type { ViewportAuditResult } from "../../src/types.js";

const mockViewport = (
  overrides: Partial<ViewportAuditResult> = {}
): ViewportAuditResult => ({
  animations: [],
  animationsScore: 95,
  animationsTier: "S",
  gpuScore: 90,
  gpuTier: "S",
  layerCount: 10,
  layers: [],
  overallScore: 95,
  overallTier: "S",
  scroll: {
    hasLayoutOnScroll: false,
    listenerCount: 0,
    selectors: [],
    usesPassive: true,
    usesRafOrDebounce: true,
  },
  scrollScore: 100,
  scrollTier: "S",
  thrashingScore: 100,
  thrashingTier: "S",
  viewport: { dpr: 2, height: 900, label: "desktop", width: 1440 },
  vramBytes: 50_000_000,
  ...overrides,
});

describe("Diagnostics Findings & AI Prompt Generation", () => {
  test("detects high desktop VRAM and produces AI fix prompt", () => {
    const desktop = mockViewport({
      gpuScore: 70,
      gpuTier: "B",
      vramBytes: 150_000_000,
    });
    const mobile = mockViewport();
    const findings = generateAuditFindings("https://site.com", desktop, mobile);

    const gpuFinding = findings.find((f) => f.id === "gpu-vram-desktop");
    assert.ok(gpuFinding);
    assert.equal(gpuFinding.severity, "high");
    assert.ok(
      gpuFinding.fixPrompt?.includes("**Target URL:** https://site.com")
    );
    assert.ok(gpuFinding.fixPrompt?.includes("Desktop VRAM"));
  });

  test("does not raise GPU VRAM warning if viewport overall GPU score achieved Tier S", () => {
    const desktop = mockViewport({
      gpuScore: 90,
      gpuTier: "S",
      vramBytes: 135_000_000,
    });
    const mobile = mockViewport();
    const findings = generateAuditFindings("https://site.com", desktop, mobile);

    const gpuFinding = findings.find((f) => f.id === "gpu-vram-desktop");
    assert.equal(gpuFinding, undefined);
  });

  test("detects layout animations (width/height) and produces refactoring prompt", () => {
    const desktop = mockViewport({
      animations: [
        {
          durationMs: 300,
          id: "1",
          paintArea: 40_000,
          properties: ["width", "height"],
          selector: ".hero-card",
          source: "waapi",
          tier: "D",
        },
      ],
    });
    const mobile = mockViewport();
    const findings = generateAuditFindings("https://site.com", desktop, mobile);

    const animFinding = findings.find((f) => f.id === "anim-layout-props");
    assert.ok(animFinding);
    assert.equal(animFinding.severity, "critical");
    assert.ok(animFinding.selectors?.includes(".hero-card"));
    assert.ok(animFinding.fixPrompt?.includes("scaleX"));
  });

  test("detects non-passive scroll event listeners with appropriate severity", () => {
    const desktop = mockViewport({
      scroll: {
        hasLayoutOnScroll: false,
        listenerCount: 2,
        selectors: ["window", "#nav"],
        usesPassive: false,
        usesRafOrDebounce: true,
      },
    });
    const mobile = mockViewport();
    const findings = generateAuditFindings("https://site.com", desktop, mobile);

    const scrollFinding = findings.find((f) => f.id === "scroll-non-passive");
    assert.ok(scrollFinding);
    assert.equal(scrollFinding.severity, "low");
    assert.ok(scrollFinding.fixPrompt?.includes("{ passive: true }"));

    // If hasLayoutOnScroll is true, severity must escalate to high
    const desktopWithReflow = mockViewport({
      scroll: {
        hasLayoutOnScroll: true,
        listenerCount: 2,
        selectors: ["window", "#nav"],
        usesPassive: false,
        usesRafOrDebounce: true,
      },
    });
    const criticalFindings = generateAuditFindings(
      "https://site.com",
      desktopWithReflow,
      mobile
    );
    const criticalScrollFinding = criticalFindings.find(
      (f) => f.id === "scroll-non-passive"
    );
    assert.ok(criticalScrollFinding);
    assert.equal(criticalScrollFinding.severity, "high");
  });

  test("detects layout thrashing violations", () => {
    const desktop = mockViewport({ thrashingScore: 40 });
    const mobile = mockViewport();
    const findings = generateAuditFindings("https://site.com", desktop, mobile);

    const thrashFinding = findings.find((f) => f.id === "layout-thrashing");
    assert.ok(thrashFinding);
    assert.equal(thrashFinding.severity, "critical");
    assert.ok(thrashFinding.fixPrompt?.includes("read-after-write"));
  });
});
