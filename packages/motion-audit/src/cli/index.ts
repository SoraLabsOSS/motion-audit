import { writeFileSync } from "node:fs";

import { log } from "@clack/prompts";
import pc from "picocolors";

import { audit } from "../index.js";
import type { MotionAuditReport, Tier } from "../types.js";
import type { CliOptions } from "./args.js";
import { parseCliArgs, printUsage } from "./args.js";
import { generateSvgBadge } from "./badge.js";
import { renderTerminalReport, spinner } from "./ui.js";

const TIER_ORDER: Tier[] = ["S", "A", "B", "C", "D", "F"];

const meetsThreshold = (actual: Tier, threshold: Tier): boolean =>
  TIER_ORDER.indexOf(actual) <= TIER_ORDER.indexOf(threshold);

const validateTargetUrl = (rawTarget: string): string => {
  try {
    const raw =
      rawTarget.startsWith("http://") || rawTarget.startsWith("https://")
        ? rawTarget
        : `https://${rawTarget}`;
    return new URL(raw).href;
  } catch {
    console.error(
      pc.red(
        `Error: "${rawTarget}" is not a valid URL.\nExample: https://example.com or http://localhost:3000\n`
      )
    );
    process.exit(2);
  }
};

const renderAiReport = (report: MotionAuditReport): void => {
  const promptSections = [
    `# SoraLabs Motion Audit AI Refactoring Report for ${report.url}`,
    `**Overall Grade:** Tier ${report.overallTier} (${report.overallScore}/100)`,
    "",
    "## Summary Findings",
  ];

  if (report.findings.length === 0) {
    promptSections.push(
      "No performance anti-patterns found. All animations are optimal Tier S."
    );
  } else {
    for (const [i, f] of report.findings.entries()) {
      promptSections.push(
        `### Finding ${i + 1}: ${f.title} [${f.severity.toUpperCase()}]`,
        f.description,
        `**Recommendation:** ${f.recommendation}`
      );
      if (f.fixPrompt) {
        promptSections.push("", "#### Fix Instructions:", f.fixPrompt);
      }
      promptSections.push("");
    }
  }

  console.log(promptSections.join("\n"));
};

const handleOutputs = (
  report: MotionAuditReport,
  opts: CliOptions,
  isMachineMode: boolean
): void => {
  if (opts.badge !== null) {
    const badgePath = opts.badge.length > 0 ? opts.badge : "motion-audit.svg";
    const svg = generateSvgBadge(report.overallTier, report.overallScore);
    writeFileSync(badgePath, svg, "utf-8");
    if (!opts.json && !opts.ai) {
      log.success(pc.green(`Generated SVG badge at ${pc.bold(badgePath)}`));
    }
  }

  if (opts.summary) {
    const summaryPayload = {
      criticalCount: report.findings.filter((f) => f.severity === "critical")
        .length,
      desktopScore: report.desktop.overallScore,
      findingsCount: report.findings.length,
      mobileScore: report.mobile.overallScore,
      overallScore: report.overallScore,
      overallTier: report.overallTier,
      timestamp: report.timestamp,
      url: report.url,
    };
    writeFileSync(
      opts.summary,
      JSON.stringify(summaryPayload, null, 2),
      "utf-8"
    );
    if (!isMachineMode) {
      log.success(
        pc.green(`Summary report written to ${pc.bold(opts.summary)}`)
      );
    }
  }

  if (opts.threshold) {
    const pass = meetsThreshold(report.overallTier, opts.threshold);
    if (!pass) {
      console.error(
        pc.red(
          `\nCI Guard Failure: Audit tier ${report.overallTier} does not meet threshold ${opts.threshold}.\n`
        )
      );
      process.exit(1);
    } else if (!isMachineMode) {
      log.success(
        pc.green(
          `Threshold check passed: Tier ${report.overallTier} >= ${opts.threshold}`
        )
      );
    }
  }
};

export const runCli = async (argv: string[]): Promise<void> => {
  const opts = parseCliArgs(argv);
  if (!opts) {
    printUsage();
    process.exit(2);
  }

  if (opts.help) {
    printUsage();
    process.exit(0);
  }

  if (opts.version) {
    console.log("0.1.0");
    process.exit(0);
  }

  if (opts.noColor) {
    process.env.NO_COLOR = "1";
  }

  if (!opts.url) {
    console.error(pc.red("Error: Target URL is required.\n"));
    printUsage();
    process.exit(2);
  }

  const validatedUrl = validateTargetUrl(opts.url);

  const isMachineMode = opts.json || opts.ai;
  const isInteractive = Boolean(process.stderr.isTTY) && !opts.json;
  const progressSpinner = isInteractive
    ? spinner({ output: process.stderr })
    : null;

  const startProgress = (msg: string) => {
    if (progressSpinner) {
      progressSpinner.start(msg);
    } else if (!opts.json) {
      process.stderr.write(`[motion-audit] ${msg}\n`);
    }
  };

  const stopProgress = (_msg?: string) => {
    if (progressSpinner) {
      progressSpinner.stop();
    }
  };

  const sigintHandler = () => {
    stopProgress();
    process.exit(130);
  };
  process.on("SIGINT", sigintHandler);
  process.on("SIGTERM", sigintHandler);

  try {
    startProgress(`Auditing motion performance: ${validatedUrl}...`);

    const report = await audit(validatedUrl, {
      desktopOnly: opts.desktopOnly,
      mobileOnly: opts.mobileOnly,
      onProgress: (msg) => {
        if (progressSpinner) {
          progressSpinner.message(msg);
        } else if (!opts.json) {
          process.stderr.write(`[motion-audit] ${msg}\n`);
        }
      },
    });

    stopProgress();

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else if (opts.ai) {
      renderAiReport(report);
    } else {
      renderTerminalReport(report, {
        desktopOnly: opts.desktopOnly,
        mobileOnly: opts.mobileOnly,
      });
    }

    handleOutputs(report, opts, isMachineMode);
    process.exit(0);
  } catch (error: unknown) {
    stopProgress("Audit execution failed.");
    const message = error instanceof Error ? error.message : String(error);
    console.error(pc.red(`\nAudit Error: ${message}\n`));

    if (
      message.includes("Could not find Chrome") ||
      message.includes("Browser was not found")
    ) {
      console.error(
        pc.yellow(
          'Tip: Run "bunx @puppeteer/browsers install chrome" to download Chromium locally.\n'
        )
      );
    } else if (
      message.includes("sandbox") ||
      message.includes("No usable sandbox")
    ) {
      console.error(
        pc.yellow(
          "Tip: Inside Docker/containers, set MOTION_AUDIT_NO_SANDBOX=1.\n"
        )
      );
    }

    process.exit(2);
  } finally {
    process.off("SIGINT", sigintHandler);
    process.off("SIGTERM", sigintHandler);
  }
};
