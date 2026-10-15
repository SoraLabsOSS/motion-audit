import type { AuditFinding, MotionAuditReport } from "@soralasbs/motion-audit";
import { audit } from "@soralasbs/motion-audit";
import type { InferSchema, ToolMetadata } from "xmcp";
import { z } from "zod";

export const schema = {
  desktopOnly: z
    .boolean()
    .optional()
    .describe("Audit only the 1440x900 @ DPR 2 desktop viewport"),
  mobileOnly: z
    .boolean()
    .optional()
    .describe("Audit only the 390x844 @ DPR 3 mobile viewport"),
  url: z
    .string()
    .describe(
      "The URL of the webpage to audit (e.g. 'http://localhost:3000' or 'https://example.com')"
    ),
};

export const metadata: ToolMetadata = {
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
    readOnlyHint: true,
    title: "Audit Motion & Animation Performance",
  },
  description:
    "Audits web animations, scroll dynamics, layout thrashing, and GPU memory of a URL using headless Chromium. Returns an S-to-F tier, numerical score (0-100), and detailed findings.",
  name: "audit_motion",
};

const formatFindings = (findings: AuditFinding[]): string => {
  if (findings.length === 0) {
    return "No performance issues detected. All animations are compositor-friendly.";
  }

  const lines: string[] = [];
  let index = 1;
  for (const f of findings) {
    const selectors = f.selectors?.length
      ? `\n   Elements: ${f.selectors.join(", ")}`
      : "";
    const fixPrompt = f.fixPrompt
      ? `\n   AI Fix Directive: ${f.fixPrompt.slice(0, 150)}...`
      : "";
    lines.push(
      `${index}. [${f.severity.toUpperCase()}] **${f.title}** (${f.category})\n   ${f.description}\n   Recommendation: ${f.recommendation}${selectors}${fixPrompt}`
    );
    index += 1;
  }

  return lines.join("\n\n");
};

const formatReportSummary = (report: MotionAuditReport): string => {
  const { desktop, mobile } = report;

  return `# Motion Audit Report: ${report.url}
**Overall Grade:** Tier ${report.overallTier} (${report.overallScore}/100)
**Timestamp:** ${report.timestamp}

---

## Viewport Breakdown

### Desktop (1440x900 @ DPR 2)
- Overall: Tier ${desktop.overallTier} (${desktop.overallScore}/100)
- Compositor & Animation Pipeline: Tier ${desktop.animationsTier} (${desktop.animationsScore}/100, ${desktop.animations.length} animations tracked)
- Scroll Dynamics: Tier ${desktop.scrollTier} (${desktop.scrollScore}/100, ${desktop.scroll.listenerCount} listeners)
- Layout Stability (Thrashing): Tier ${desktop.thrashingTier} (${desktop.thrashingScore}/100)
- GPU Memory & Layers: Tier ${desktop.gpuTier} (${desktop.gpuScore}/100, ${desktop.layerCount} layers, ~${Math.round(desktop.vramBytes / 1024 / 1024)}MB VRAM)

### Mobile (390x844 @ DPR 3)
- Overall: Tier ${mobile.overallTier} (${mobile.overallScore}/100)
- Compositor & Animation Pipeline: Tier ${mobile.animationsTier} (${mobile.animationsScore}/100, ${mobile.animations.length} animations tracked)
- Scroll Dynamics: Tier ${mobile.scrollTier} (${mobile.scrollScore}/100, ${mobile.scroll.listenerCount} listeners)
- Layout Stability (Thrashing): Tier ${mobile.thrashingTier} (${mobile.thrashingScore}/100)
- GPU Memory & Layers: Tier ${mobile.gpuTier} (${mobile.gpuScore}/100, ${mobile.layerCount} layers, ~${Math.round(mobile.vramBytes / 1024 / 1024)}MB VRAM)

---

## Actionable Findings & Fixes
${formatFindings(report.findings)}
`;
};

export default async function auditMotion({
  desktopOnly,
  mobileOnly,
  url,
}: InferSchema<typeof schema>) {
  try {
    const report = await audit(url, {
      desktopOnly,
      mobileOnly,
    });

    const summary = formatReportSummary(report);

    return {
      content: [
        {
          text: summary,
          type: "text",
        },
      ],
      structuredContent: {
        desktop: {
          animationsScore: report.desktop.animationsScore,
          animationsTier: report.desktop.animationsTier,
          gpuScore: report.desktop.gpuScore,
          gpuTier: report.desktop.gpuTier,
          layerCount: report.desktop.layerCount,
          overallScore: report.desktop.overallScore,
          overallTier: report.desktop.overallTier,
          scrollScore: report.desktop.scrollScore,
          scrollTier: report.desktop.scrollTier,
          thrashingScore: report.desktop.thrashingScore,
          thrashingTier: report.desktop.thrashingTier,
          vramBytes: report.desktop.vramBytes,
        },
        findings: report.findings.map((f) => ({
          category: f.category,
          description: f.description,
          fixPrompt: f.fixPrompt,
          id: f.id,
          recommendation: f.recommendation,
          selectors: f.selectors,
          severity: f.severity,
          title: f.title,
          viewport: f.viewport,
        })),
        mobile: {
          animationsScore: report.mobile.animationsScore,
          animationsTier: report.mobile.animationsTier,
          gpuScore: report.mobile.gpuScore,
          gpuTier: report.mobile.gpuTier,
          layerCount: report.mobile.layerCount,
          overallScore: report.mobile.overallScore,
          overallTier: report.mobile.overallTier,
          scrollScore: report.mobile.scrollScore,
          scrollTier: report.mobile.scrollTier,
          thrashingScore: report.mobile.thrashingScore,
          thrashingTier: report.mobile.thrashingTier,
          vramBytes: report.mobile.vramBytes,
        },
        overallScore: report.overallScore,
        overallTier: report.overallTier,
        timestamp: report.timestamp,
        url: report.url,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Audit failed for "${url}": ${message}.\n\nEnsure Chromium is available or install it via: bunx @puppeteer/browsers install chrome\nIf running inside Docker or restricted container, set MOTION_AUDIT_NO_SANDBOX=1.`;
  }
}
