import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { parseCliArgs } from "../../src/cli/args.js";

describe("CLI Args Parser (clig.dev compliant)", () => {
  test("parses target URL and default flags", () => {
    const opts = parseCliArgs(["https://example.com"]);
    assert.ok(opts);
    assert.equal(opts.url, "https://example.com");
    assert.equal(opts.json, false);
    assert.equal(opts.ai, false);
    assert.equal(opts.threshold, null);
  });

  test("parses -h and --help", () => {
    const opts1 = parseCliArgs(["--help"]);
    assert.ok(opts1);
    assert.equal(opts1.help, true);

    const opts2 = parseCliArgs(["-h"]);
    assert.ok(opts2);
    assert.equal(opts2.help, true);
  });

  test("parses -v and --version", () => {
    const opts = parseCliArgs(["--version"]);
    assert.ok(opts);
    assert.equal(opts.version, true);
  });

  test("parses --json and --ai flags", () => {
    const opts = parseCliArgs(["https://example.com", "--json", "--ai"]);
    assert.ok(opts);
    assert.equal(opts.json, true);
    assert.equal(opts.ai, true);
  });

  test("parses --threshold flag and normalizes to uppercase", () => {
    const opts = parseCliArgs(["https://example.com", "--threshold", "a"]);
    assert.ok(opts);
    assert.equal(opts.threshold, "A");
  });

  test("parses --badge and --summary", () => {
    const opts = parseCliArgs([
      "https://example.com",
      "--badge",
      "custom.svg",
      "--summary",
      "out.json",
    ]);
    assert.ok(opts);
    assert.equal(opts.badge, "custom.svg");
    assert.equal(opts.summary, "out.json");
  });

  test("parses viewport filters", () => {
    const opts = parseCliArgs(["https://example.com", "--desktop-only"]);
    assert.ok(opts);
    assert.equal(opts.desktopOnly, true);
    assert.equal(opts.mobileOnly, false);
  });
});
