import { describe, it, expect } from "bun:test";
import { setTimeout as sleep } from "node:timers/promises";

import { launch } from "puppeteer";

import { INPAGE_INIT_SCRIPT } from "../../src/collector/inpage.js";
import {
  classifyPropertyCost,
  PIPELINE_COSTS,
} from "../../src/math/scaling.js";

declare global {
  interface Window {
    __MOTION_AUDIT__?: {
      getJsAnimations: () => {
        id: string;
        properties: string[];
        selector: string;
      }[];
    };
  }
}

describe("SVG Animation Detection & Scoring Verification", () => {
  it("detects runtime SVG attribute mutations in browser", async () => {
    const browser = await launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });

    try {
      const page = await browser.newPage();
      await page.evaluateOnNewDocument(INPAGE_INIT_SCRIPT);

      // Navigate to a page with an SVG path
      const html = `data:text/html,<!DOCTYPE html><html><body><svg viewBox="0 0 100 100" width="100" height="100"><path id="morph-path" d="M 10 10 H 90 V 90 H 10 Z" /></svg></body></html>`;
      await page.goto(html);

      // Simulate JS animation mutating 'd' attribute 5 times (sustained animation loop)
      await page.evaluate(() => {
        const path = document.querySelector("#morph-path");
        if (path) {
          path.setAttribute("d", "M 20 20 H 80 V 80 H 20 Z");
          path.setAttribute("d", "M 30 30 H 70 V 70 H 30 Z");
          path.setAttribute("d", "M 40 40 H 60 V 60 H 40 Z");
          path.setAttribute("d", "M 50 50 H 50 V 50 H 50 Z");
          path.setAttribute("d", "M 60 60 H 40 V 40 H 60 Z");
        }
      });

      // Wait a tick for MutationObserver callbacks to flush
      await sleep(100);

      const detected = await page.evaluate(() => {
        const audit = window.__MOTION_AUDIT__;
        return audit ? audit.getJsAnimations() : [];
      });

      // 1. Proves sustained SVG path animation is captured by inpage script
      expect(detected.length).toBeGreaterThan(0);
      const svgAnim = detected.find((a) => a.properties.includes("d"));
      expect(svgAnim).toBeDefined();
      expect(svgAnim?.selector).toContain("morph-path");

      // 2. Proves scoring engine correctly penalizes SVG geometric reflow
      if (svgAnim) {
        const cost = classifyPropertyCost(svgAnim.properties[0]);
        expect(cost).toBe(PIPELINE_COSTS.LAYOUT);
      }
    } finally {
      await browser.close();
    }
  }, 20_000);
});
