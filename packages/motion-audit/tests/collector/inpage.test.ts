import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { INPAGE_INIT_SCRIPT } from "../../src/collector/inpage.js";

describe("Inpage Script Injection Validity", () => {
  test("INPAGE_INIT_SCRIPT contains valid JavaScript IIFE", () => {
    assert.ok(INPAGE_INIT_SCRIPT.length > 0);
    assert.ok(INPAGE_INIT_SCRIPT.trim().startsWith("(() => {"));
    assert.ok(INPAGE_INIT_SCRIPT.trim().endsWith("})();"));
    assert.ok(INPAGE_INIT_SCRIPT.includes("window.__MOTION_AUDIT__"));
  });

  test("INPAGE_INIT_SCRIPT intercepts passive scroll listeners", () => {
    assert.ok(
      INPAGE_INIT_SCRIPT.includes("EventTarget.prototype.addEventListener")
    );
    assert.ok(INPAGE_INIT_SCRIPT.includes("type === 'scroll'"));
    assert.ok(
      INPAGE_INIT_SCRIPT.includes("isPassive = Boolean(options.passive)")
    );
  });

  test("INPAGE_INIT_SCRIPT hooks into layout thrashing getter properties", () => {
    assert.ok(INPAGE_INIT_SCRIPT.includes("offsetHeight"));
    assert.ok(
      INPAGE_INIT_SCRIPT.includes("getBoundingClientRect") ||
        INPAGE_INIT_SCRIPT.includes("clientWidth")
    );
    assert.ok(INPAGE_INIT_SCRIPT.includes("performance.now()"));
  });

  test("INPAGE_INIT_SCRIPT observes SVG vector attribute animations", () => {
    assert.ok(INPAGE_INIT_SCRIPT.includes("SVGElement"));
    assert.ok(INPAGE_INIT_SCRIPT.includes("stroke-dashoffset"));
    assert.ok(INPAGE_INIT_SCRIPT.includes("'d'"));
  });
});
