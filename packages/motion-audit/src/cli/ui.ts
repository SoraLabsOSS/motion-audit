import {
  intro,
  log,
  note,
  outro,
  spinner as clackSpinner,
} from "@clack/prompts";
import pc from "picocolors";

import type { MotionAuditReport, Tier, ViewportAuditResult } from "../types.js";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const FRAME_DELAY_MS = 80;

/**
 * Shared spinner styling for every long-running fetch/resolve step —
 * braille frames plus an elapsed-time suffix (indicator: "timer") so a
 * slow network reads as "still working, N seconds in" rather than a bare
 * spin with no sense of progress.
 */
export const spinner = (opts?: Parameters<typeof clackSpinner>[0]) =>
  clackSpinner({
    delay: FRAME_DELAY_MS,
    frames: BRAILLE_FRAMES,
    indicator: "timer",
    ...opts,
  });

const TIER_COLORS: Record<Tier, string> = {
  A: pc.green(pc.bold("Tier A")),
  B: pc.cyan(pc.bold("Tier B")),
  C: pc.blue(pc.bold("Tier C")),
  D: pc.magenta(pc.bold("Tier D")),
  F: pc.bgRed(pc.white(pc.bold(" Tier F "))),
  S: pc.yellow(pc.bold("Tier S")),
};

const TIER_BADGES: Record<Tier, string> = {
  A: pc.bgGreen(pc.black(pc.bold(" A "))),
  B: pc.bgCyan(pc.black(pc.bold(" B "))),
  C: pc.bgBlue(pc.white(pc.bold(" C "))),
  D: pc.bgMagenta(pc.white(pc.bold(" D "))),
  F: pc.bgRed(pc.white(pc.bold(" F "))),
  S: pc.bgYellow(pc.black(pc.bold(" S "))),
};

export const colorTier = (tier: Tier): string => TIER_COLORS[tier] ?? tier;
export const badgeTier = (tier: Tier): string => TIER_BADGES[tier] ?? tier;

const formatViewportCard = (name: string, vp: ViewportAuditResult): string => {
  const mb = Math.round(vp.vramBytes / (1024 * 1024));
  const vramDetail = pc.dim(`${mb}MB across ${vp.layerCount} layers`);
  const animDetail = pc.dim(`${vp.animations.length} animations tracked`);
  const passiveLabel = vp.scroll.usesPassive ? "passive" : "sync";
  const scrollDetail = pc.dim(
    `${vp.scroll.listenerCount} listeners (${passiveLabel})`
  );
  const thrashDetail = pc.dim(`Score: ${vp.thrashingScore}/100`);
  const lines: string[] = [
    `${pc.bold(name)} ${badgeTier(vp.overallTier)} (${vp.overallScore}/100)`,
    pc.dim("----------------------------------------"),
    `  GPU VRAM:        ${badgeTier(vp.gpuTier)} ${vramDetail}`,
    `  Animations:      ${badgeTier(vp.animationsTier)} ${animDetail}`,
    `  Scroll Dynamics: ${badgeTier(vp.scrollTier)} ${scrollDetail}`,
    `  Layout Thrash:   ${badgeTier(vp.thrashingTier)} ${thrashDetail}`,
  ];
  return lines.join("\n");
};

export interface RenderReportOptions {
  desktopOnly?: boolean;
  mobileOnly?: boolean;
}

export const renderTerminalReport = (
  report: MotionAuditReport,
  options?: RenderReportOptions
): void => {
  intro(pc.bgMagenta(pc.white(pc.bold(" SoraLabs Motion Audit "))));

  log.info(`${pc.bold("Target URL:")} ${pc.underline(report.url)}`);

  // Viewport Scorecards
  if (!options?.mobileOnly) {
    note(
      formatViewportCard("Desktop Viewport (1440x900 @ DPR 2)", report.desktop),
      "Desktop Analysis"
    );
  }
  if (!options?.desktopOnly) {
    note(
      formatViewportCard("Mobile Viewport (390x844 @ DPR 3)", report.mobile),
      "Mobile Analysis"
    );
  }

  // Overall Grade
  log.step(
    `${pc.bold("Overall Grade:")} ${badgeTier(report.overallTier)} ${colorTier(report.overallTier)} — Score: ${pc.bold(report.overallScore.toString())}/100`
  );

  // Findings
  if (report.findings.length > 0) {
    const findingLines = report.findings.map((f, i) => {
      let sevColor = pc.blue;
      if (f.severity === "critical") {
        sevColor = pc.red;
      } else if (f.severity === "high") {
        sevColor = pc.yellow;
      }
      const tag = sevColor(`[${f.severity.toUpperCase()}]`);
      let item = `${i + 1}. ${tag} ${pc.bold(f.title)} (${f.viewport})\n   ${pc.dim(f.description)}\n   ${pc.green("Fix:")} ${f.recommendation}`;
      if (f.selectors && f.selectors.length > 0) {
        item += `\n   ${pc.cyan("Selectors:")} ${f.selectors.slice(0, 4).join(", ")}`;
      }
      return item;
    });

    note(
      findingLines.join("\n\n"),
      `Audit Findings (${report.findings.length} detected)`
    );
  } else {
    log.success(
      pc.green(
        "All 4 measurement pillars are pristine (Tier S). No anti-patterns detected!"
      )
    );
  }

  outro(
    pc.dim(
      "Audit complete. Run with --ai to export refactoring prompts for Cursor/Claude."
    )
  );
};
