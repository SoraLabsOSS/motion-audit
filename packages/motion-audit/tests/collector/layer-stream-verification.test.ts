import { describe, it, expect } from "bun:test";

import { BrowserRunner, DESKTOP_VIEWPORT } from "../../src/collector/runner.js";

// Base64 keeps "#" ids and whitespace in the fixture from truncating the URL.
const pageUrl = (html: string): string =>
  `data:text/html;base64,${Buffer.from(html, "utf-8").toString("base64")}`;

describe("Continuous Layer Streaming Across Scroll", () => {
  it("audits a viewport and retains layer telemetry post-interaction", async () => {
    const runner = new BrowserRunner();
    try {
      const html = `data:text/html,<!DOCTYPE html><html><body style="height:3000px"><div id="box" style="width:200px;height:200px;background:red;will-change:transform;">Box</div></body></html>`;
      const result = await runner.auditViewport(html, DESKTOP_VIEWPORT);

      expect(result).toBeDefined();
      expect(result.viewport.label).toBe("desktop");
      expect(result.measured).toBe(true);
      expect(Number.isFinite(result.gpuScore)).toBe(true);
      expect(["S", "B"]).toContain(result.gpuTier);
      expect(result.layers).toBeDefined();
      expect(Array.isArray(result.layers)).toBe(true);
    } finally {
      await runner.close();
    }
  }, 30_000);

  it("audits animations, detects layer promotion, and scores animation pillar", async () => {
    const runner = new BrowserRunner();
    try {
      const html =
        'data:text/html,<!DOCTYPE html><html><head><style>@keyframes slide { from { transform: translateX(0px); } to { transform: translateX(100px); } } .anim-box { width: 100px; height: 100px; animation: slide 1s infinite; will-change: transform; }</style></head><body><div class="anim-box" id="anim-box">Moving</div></body></html>';
      const result = await runner.auditViewport(html, DESKTOP_VIEWPORT);
      expect(result.animations.length).toBeGreaterThan(0);
      const boxAnim = result.animations.find((a) =>
        a.selector.includes("anim-box")
      );
      expect(boxAnim).toBeDefined();
      expect(boxAnim?.hasWillChange).toBe(true);
      expect(boxAnim?.isPromoted).toBe(true);
      expect(result.animationsScore).toBeGreaterThanOrEqual(80);
    } finally {
      await runner.close();
    }
  }, 30_000);

  it("matches frame samples to animations for id and multi-class selectors", async () => {
    const runner = new BrowserRunner();
    try {
      const html = pageUrl(
        "<!DOCTYPE html><html><head><style>@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } #by-id, .by-class.multi { width: 80px; height: 80px; animation: spin 1s infinite; }</style></head>" +
          '<body><div id="by-id">a</div><div class="by-class multi">b</div>' +
          "<script>let n=0;function tick(){n++;if(n<200)requestAnimationFrame(tick)}requestAnimationFrame(tick)</script></body></html>"
      );
      const result = await runner.auditViewport(html, DESKTOP_VIEWPORT);

      expect(result.animations.length).toBe(2);
      for (const animation of result.animations) {
        expect(animation.frames?.length ?? 0).toBeGreaterThan(0);
      }
    } finally {
      await runner.close();
    }
  }, 30_000);
});
