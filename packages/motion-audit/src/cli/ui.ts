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

const formatMB = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toFixed(1)}MB`;

const truncate = (str: string, maxLen: number): string => {
  if (!str) {
    return "";
  }
  return str.length > maxLen ? `${str.slice(0, maxLen - 3)}...` : str;
};

const formatWaapiLines = (
  waapiAnims: ViewportAuditResult["animations"]
): string[] => {
  if (waapiAnims.length === 0) {
    return [];
  }
  const lines: string[] = [
    `  ${pc.bold("WAAPI animations")} / ${waapiAnims.length}`,
    pc.dim(
      "  Tier  Element                                              Properties       Duration  Notes"
    ),
  ];
  for (const a of waapiAnims.slice(0, 8)) {
    const tierBadge = badgeTier(a.tier);
    const el = truncate(a.selector, 48).padEnd(50);
    const props = truncate(a.properties.join(", "), 15).padEnd(16);
    const dur = `${Math.round(a.durationMs || 0)}ms`.padStart(8);
    const notes = a.notes ? a.notes.join(", ") : "";
    lines.push(`  ${tierBadge}  ${el} ${props} ${dur}  ${pc.dim(notes)}`);
  }
  if (waapiAnims.length > 8) {
    lines.push(
      pc.dim(`  ... and ${waapiAnims.length - 8} more WAAPI animations`)
    );
  }
  lines.push("");
  return lines;
};

const formatJsLines = (
  jsAnims: ViewportAuditResult["animations"]
): string[] => {
  if (jsAnims.length === 0) {
    return [];
  }
  const lines: string[] = [
    `  ${pc.bold("JavaScript animations")} / ${jsAnims.length}`,
    pc.dim(
      "  Tier  Element                                              Properties       Frames    Notes"
    ),
  ];
  for (const a of jsAnims.slice(0, 8)) {
    const tierBadge = badgeTier(a.tier);
    const el = truncate(a.selector, 48).padEnd(50);
    const props = truncate(a.properties.join(", "), 15).padEnd(16);
    const frames =
      `${a.frameCount || (a.frames ? a.frames.length : 0)}`.padStart(8);
    let notes = a.notes ? a.notes.join(", ") : "";
    if (notes.includes("MISSING WILL-CHANGE")) {
      notes = pc.yellow(pc.bold(notes));
    }
    lines.push(`  ${tierBadge}  ${el} ${props} ${frames}  ${notes}`);
  }
  if (jsAnims.length > 8) {
    lines.push(
      pc.dim(`  ... and ${jsAnims.length - 8} more JavaScript animations`)
    );
  }
  lines.push("");
  return lines;
};

const formatAnimationsSection = (vp: ViewportAuditResult): string[] => {
  const lines: string[] = [];
  const waapiAnims = vp.animations.filter(
    (a) => a.kind === "waapi" || (!a.kind && a.source === "waapi")
  );
  const jsAnims = vp.animations.filter(
    (a) => a.kind === "javascript" || (!a.kind && a.source === "js-loop")
  );

  const totalAnims = vp.animations.length;
  const tierCounts: Record<string, number> = {};
  for (const a of vp.animations) {
    tierCounts[a.tier] = (tierCounts[a.tier] || 0) + 1;
  }
  const validTiers: Tier[] = ["S", "A", "B", "C", "D", "F"];
  const breakdownParts = validTiers
    .filter((t) => tierCounts[t])
    .map((t) => {
      const count = tierCounts[t];
      const pct = totalAnims > 0 ? Math.round((count / totalAnims) * 100) : 0;
      return `${colorTier(t)}: ${count} (${pct}%)`;
    });

  lines.push(
    `${pc.bold("Animations")}  ${badgeTier(vp.animationsTier)} (${vp.animations.length} animations tracked)`
  );
  if (breakdownParts.length > 0) {
    lines.push(`  Breakdown: ${breakdownParts.join(" · ")}`, "");
  }

  lines.push(...formatWaapiLines(waapiAnims), ...formatJsLines(jsAnims));

  return lines;
};

const formatGpuPressureSection = (vp: ViewportAuditResult): string[] => {
  const lines: string[] = [];
  const textureMB = vp.textureVramBytes
    ? formatMB(vp.textureVramBytes)
    : formatMB(vp.vramBytes);
  const tiledMB = vp.tiledVramBytes ? formatMB(vp.tiledVramBytes) : "0.0MB";
  const overlapLayers = vp.layers.filter((l) => l.isOverlapPromoted);
  const willChangeLayers = vp.layers.filter((l) => l.isWillChangePromoted);

  lines.push(
    `${pc.bold("GPU pressure")}  ${badgeTier(vp.gpuTier)}`,
    `  > MEMORY`,
    `    Texture Memory:      ${pc.bold(textureMB)} @${vp.viewport.dpr}x density (Est. texture GPU)`,
    `    Tiled Memory:        ${pc.bold(tiledMB)} (Est. tiled GPU)`,
    `    Total Texture Layers:${pc.bold(String(vp.layerCount))} Compositor layers`,
    ""
  );

  if (vp.layers.length > 0) {
    lines.push(
      pc.bold("  Compositor Layers Table"),
      pc.dim(
        "  Element                                            Dimensions      Tier  Est. GPU   Paints  Notes"
      )
    );
    const sortedLayers = vp.layers.toSorted(
      (a, b) => b.compositedVramBytes - a.compositedVramBytes
    );

    for (const layer of sortedLayers.slice(0, 12)) {
      const el = truncate(layer.selector || "<layer>", 46).padEnd(48);
      const dims = `${layer.width}×${layer.height}`.padEnd(14);
      const tierBadge = badgeTier(layer.tier || "S");
      const gpu = formatMB(layer.compositedVramBytes).padStart(8);
      const paints = String(layer.paintCount || 0).padStart(6);
      const notes = (layer.notes || [])
        .map((n) => {
          if (n === "OVERLAP") {
            return pc.yellow("OVERLAP");
          }
          if (n === "TILED") {
            return pc.cyan("TILED");
          }
          if (n === "WILL-CHANGE") {
            return pc.green("WILL-CHANGE");
          }
          return n;
        })
        .join(" ");

      lines.push(`  ${el} ${dims} ${tierBadge} ${gpu}   ${paints}  ${notes}`);
    }
    if (sortedLayers.length > 12) {
      lines.push(
        pc.dim(`  ... and ${sortedLayers.length - 12} more compositor layers`)
      );
    }
  }

  if (overlapLayers.length > 0) {
    lines.push(pc.dim(`    Overlap-promoted: ${overlapLayers.length}`));
  }
  if (willChangeLayers.length > 0) {
    lines.push(pc.dim(`    Will-change: ${willChangeLayers.length}`));
  }
  lines.push("");

  return lines;
};

const SCROLL_LINKED = "scroll-linked";
const SCROLL_TRIGGERED = "scroll-triggered";

const formatScrollSection = (vp: ViewportAuditResult): string[] => {
  const lines: string[] = [];
  const scrollAnims = vp.animations.filter(
    (a) => a.kind === SCROLL_LINKED || a.kind === SCROLL_TRIGGERED
  );
  const scrollLinkedCount =
    vp.scroll.scrollLinkedCount ||
    scrollAnims.filter((a) => a.kind === SCROLL_LINKED).length;
  const scrollTriggeredCount =
    vp.scroll.scrollTriggeredCount ||
    scrollAnims.filter((a) => a.kind === SCROLL_TRIGGERED).length;

  lines.push(
    `${pc.bold("Scroll animations")}  ${badgeTier(vp.scrollTier)}`,
    `  Total detected:    ${scrollAnims.length}`,
    `  WAAPI:             ${vp.scroll.waapiCount || 0}`,
    `  JavaScript:        ${vp.scroll.jsCount || 0}`,
    `  Scroll-linked:     ${scrollLinkedCount}`,
    `  Scroll-triggered:  ${scrollTriggeredCount}`,
    `  Scroll listeners:  ${vp.scroll.listenerCount} (${vp.scroll.usesPassive ? "passive" : pc.red("non-passive")})`,
    ""
  );

  if (scrollAnims.length > 0) {
    lines.push(
      pc.bold("  Scroll Animations Breakdown"),
      pc.dim(
        "  Tier  Element                                              Properties       Trigger            Notes"
      )
    );
    for (const a of scrollAnims.slice(0, 8)) {
      const tierBadge = badgeTier(a.tier);
      const el = truncate(a.selector, 48).padEnd(50);
      const props = truncate(a.properties.join(", "), 15).padEnd(16);
      const trigger = truncate(
        a.trigger || (a.kind === SCROLL_LINKED ? "Timeline" : "Scroll"),
        17
      ).padEnd(18);
      let notes = a.notes ? a.notes.join(", ") : "";
      if (notes.includes("MISSING WILL-CHANGE")) {
        notes = pc.yellow(pc.bold(notes));
      }
      lines.push(`  ${tierBadge}  ${el} ${props} ${trigger} ${notes}`);
    }
    lines.push("");
  }

  return lines;
};

const formatThrashingSection = (vp: ViewportAuditResult): string[] => {
  const lines: string[] = [];
  const breakdown = vp.thrashingBreakdown;
  const mountCount = breakdown?.mountCount ?? 0;
  const frameCount = breakdown?.frameCount ?? 0;
  const maxConcurrentRaf = breakdown?.maxConcurrentRaf ?? 1;

  const mountMsg =
    mountCount === 0
      ? pc.green("No mount layout thrashing detected")
      : pc.red(`${mountCount} violations detected`);
  const frameMsg =
    frameCount === 0
      ? pc.green("No per-frame layout thrashing detected")
      : pc.red(`${frameCount} violations detected`);
  const rafSuffix = maxConcurrentRaf > 1 ? "s" : "";

  lines.push(
    `${pc.bold("Thrashing")}  ${badgeTier(vp.thrashingTier)} (Score: ${vp.thrashingScore}/100)`,
    `  Mount:              ${mountMsg}`,
    `  Animation frame:    ${frameMsg}`,
    `  Max concurrent rAF: ${maxConcurrentRaf} loop${rafSuffix}`,
    ""
  );

  return lines;
};

const formatDetailedViewportReport = (
  name: string,
  vp: ViewportAuditResult
): string => {
  const header = `${pc.bold(name)} ${badgeTier(vp.overallTier)} — Score: ${pc.bold(vp.overallScore.toString())}/100`;
  const separator = pc.dim("═".repeat(72));

  const sections: string[] = [
    header,
    separator,
    ...formatAnimationsSection(vp),
    ...formatGpuPressureSection(vp),
    ...formatScrollSection(vp),
    ...formatThrashingSection(vp),
  ];

  return sections.join("\n");
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

  // Viewport Detailed Reports
  if (!options?.mobileOnly) {
    note(
      formatDetailedViewportReport(
        "Desktop Viewport (1440×900 @ DPR 2)",
        report.desktop
      ),
      "Desktop Audit Analysis"
    );
  }
  if (!options?.desktopOnly) {
    note(
      formatDetailedViewportReport(
        "Mobile Viewport (390×844 @ DPR 3)",
        report.mobile
      ),
      "Mobile Audit Analysis"
    );
  }

  // Measured result first: this is the number recorded by the browser's own frame
  // timing. The model grade follows, explicitly labelled as an inference.
  const ft = report.frameTiming;
  log.step(
    ft.score === null
      ? `${pc.bold("Measured Blocking:")} ${pc.dim("unavailable in this browser")}`
      : `${pc.bold("Measured Blocking:")} ${badgeTier(ft.tier ?? "F")} ${colorTier(ft.tier ?? "F")} — ${pc.bold(String(ft.score))}/100 (${ft.verdict}) · ${ft.totalBlockingMs}ms past the 50ms LoAF threshold`
  );
  log.step(
    `${pc.dim("Model Grade:")} ${badgeTier(report.overallTier)} ${colorTier(report.overallTier)} — ${pc.bold(report.overallScore.toString())}/100 ${pc.dim("(inferred)")}`
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
        item += `\n   ${pc.cyan("Affected elements:")} ${f.selectors.slice(0, 6).join(", ")}`;
      }
      return item;
    });

    note(
      findingLines.join("\n\n"),
      `Recommendations & Findings (${report.findings.length} detected)`
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
