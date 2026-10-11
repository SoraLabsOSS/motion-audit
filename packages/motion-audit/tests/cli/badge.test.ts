import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  generateSvgBadge,
  getTierColor,
  TIER_COLORS,
} from "../../src/cli/badge.js";

describe("SVG Badge Generator", () => {
  test("generates valid SVG string for Tier S with gold/yellow background and white text", () => {
    const svg = generateSvgBadge("S", 98);
    assert.ok(svg.startsWith("<svg"));
    assert.ok(svg.includes("Tier S · 98"));
    // Gold/Yellow for S
    assert.ok(svg.includes("#dfb317"));
    // Verify background is colored with #dfb317 and text is white #fff
    assert.ok(
      svg.includes('<rect x="90" width="78" height="20" fill="#dfb317"/>')
    );
    assert.ok(
      svg.includes(
        '<text x="1280" y="140" transform="scale(.1)" fill="#fff" textLength="640">Tier S · 98</text>'
      )
    );
    assert.ok(svg.endsWith("</svg>\n"));
  });

  test("generates valid SVG string for Tier F with red background and white text", () => {
    const svg = generateSvgBadge("F", 15);
    assert.ok(svg.includes("Tier F · 15"));
    // Red for F
    assert.ok(svg.includes("#e05d44"));
    assert.ok(
      svg.includes('<rect x="90" width="78" height="20" fill="#e05d44"/>')
    );
    assert.ok(
      svg.includes(
        '<text x="1280" y="140" transform="scale(.1)" fill="#fff" textLength="640">Tier F · 15</text>'
      )
    );
  });

  test("getTierColor maps all tiers correctly", () => {
    assert.equal(getTierColor("S"), TIER_COLORS.S);
    assert.equal(getTierColor("A"), TIER_COLORS.A);
    assert.equal(getTierColor("B"), TIER_COLORS.B);
    assert.equal(getTierColor("C"), TIER_COLORS.C);
    assert.equal(getTierColor("D"), TIER_COLORS.D);
    assert.equal(getTierColor("F"), TIER_COLORS.F);
  });

  test("infers color and letter grade dynamically from numerical score", () => {
    // >= 80 -> S (Yellow)
    assert.equal(getTierColor(undefined, 95), TIER_COLORS.S);
    // >= 60 -> A (Green)
    assert.equal(getTierColor(undefined, 70), TIER_COLORS.A);
    // >= 40 -> B (Blue)
    assert.equal(getTierColor(undefined, 50), TIER_COLORS.B);
    // >= 20 -> C (Orange)
    assert.equal(getTierColor(undefined, 30), TIER_COLORS.C);
    // >= 0  -> D (Dark Orange)
    assert.equal(getTierColor(undefined, 10), TIER_COLORS.D);
    // < 0   -> F (Red)
    assert.equal(getTierColor(undefined, -5), TIER_COLORS.F);
  });
});
