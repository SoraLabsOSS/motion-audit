import { parseArgs } from "node:util";

import type { Tier } from "../types.js";

export interface CliOptions {
  url: string;
  help: boolean;
  version: boolean;
  json: boolean;
  ai: boolean;
  threshold: Tier | null;
  badge: string | null;
  summary: string | null;
  desktopOnly: boolean;
  mobileOnly: boolean;
  noColor: boolean;
}

export const parseCliArgs = (argv: string[]): CliOptions | null => {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      args: argv,
      options: {
        ai: { default: false, type: "boolean" },
        badge: { type: "string" },
        "desktop-only": { default: false, type: "boolean" },
        help: { default: false, short: "h", type: "boolean" },
        json: { default: false, type: "boolean" },
        "mobile-only": { default: false, type: "boolean" },
        "no-color": { default: false, type: "boolean" },
        summary: { type: "string" },
        threshold: { short: "t", type: "string" },
        version: { default: false, short: "v", type: "boolean" },
      },
    });

    let parsedThreshold: Tier | null = null;
    if (values.threshold) {
      const t = values.threshold.toUpperCase();
      if (["S", "A", "B", "C", "D", "F"].includes(t)) {
        // SAFETY: Array inclusion check guarantees t is a valid Tier
        parsedThreshold = t as Tier;
      }
    }

    const help = Boolean(values.help);
    const version = !help && Boolean(values.version);
    const isMeta = help || version;

    return {
      ai: isMeta ? false : Boolean(values.ai),
      badge: isMeta ? null : (values.badge ?? null),
      desktopOnly: isMeta ? false : Boolean(values["desktop-only"]),
      help,
      json: isMeta ? false : Boolean(values.json),
      mobileOnly: isMeta ? false : Boolean(values["mobile-only"]),
      noColor: isMeta ? false : Boolean(values["no-color"]),
      summary: isMeta ? null : (values.summary ?? null),
      threshold: isMeta ? null : parsedThreshold,
      url: isMeta ? "" : (positionals[0] ?? ""),
      version,
    };
  } catch {
    return null;
  }
};

export const printUsage = (): void => {
  console.log(`
motion-audit <url> [options]

Independent Web Animation & Motion Performance Auditor

Usage:
  npx @soralasbs/motion-audit https://example.com
  npx @soralasbs/motion-audit http://localhost:3000 --ai
  npx @soralasbs/motion-audit https://example.com --threshold A

Options:
  --json              Output machine-readable JSON to stdout (free, unrestricted)
  --ai                Output AI Refactoring Prompt for Cursor / Claude / Copilot
  --threshold <tier>  CI/CD Guard: exit code 1 if grade is worse than tier (S/A/B/C/D/F)
  --badge [file]      Generate SVG badge for GitHub README (default: motion-audit.svg)
  --summary <file>    Write compact JSON summary report to file
  --desktop-only      Audit only desktop viewport (1440x900 @ DPR 2)
  --mobile-only       Audit only mobile viewport (390x844 @ DPR 3)
  --no-color          Disable ANSI color formatting
  -h, --help          Show this help message
  -v, --version       Show version number

Exit Codes:
  0: Success / Met threshold
  1: Failed threshold check
  2: Execution error / Invalid URL
`);
};
