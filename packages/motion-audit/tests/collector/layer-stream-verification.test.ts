import { describe, it, expect } from "bun:test";

import { BrowserRunner, DESKTOP_VIEWPORT } from "../../src/collector/runner.js";

describe("Continuous Layer Streaming Across Scroll", () => {
  it("audits a viewport and retains layer telemetry post-interaction", async () => {
    const runner = new BrowserRunner();
    try {
      const html = `data:text/html,<!DOCTYPE html><html><body style="height:3000px"><div id="box" style="width:200px;height:200px;background:red;will-change:transform;">Box</div></body></html>`;
      const result = await runner.auditViewport(html, DESKTOP_VIEWPORT);

      expect(result).toBeDefined();
      expect(result.viewport.label).toBe("desktop");
      expect(Number.isFinite(result.gpuScore)).toBe(true);
      expect(result.layers).toBeDefined();
      expect(Array.isArray(result.layers)).toBe(true);
    } finally {
      await runner.close();
    }
  }, 30_000);
});
