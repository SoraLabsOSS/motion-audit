import { audit } from "@soralasbs/motion-audit";
import type { InferSchema, ToolMetadata } from "xmcp";
import { z } from "zod";

export const schema = {
  category: z
    .enum([
      "gpu",
      "blur",
      "will-change",
      "layout-animation",
      "scroll",
      "thrashing",
      "offscreen-animation",
      "all",
    ])
    .optional()
    .describe(
      "Optional filter by issue category (e.g. 'layout-animation', 'thrashing', 'scroll', 'gpu')"
    ),
  url: z
    .string()
    .describe(
      "The URL of the webpage to audit and generate AI remediation directives for"
    ),
};

export const metadata: ToolMetadata = {
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
    readOnlyHint: true,
    title: "Generate AI Remediation Prompt",
  },
  description:
    "Audits a webpage and generates a comprehensive, production-grade technical remediation prompt for AI coding assistants (Claude, Cursor, Copilot) to fix animation jank, layout thrashing, and GPU memory bloat.",
  name: "get_remediation_prompt",
};

export default async function getRemediationPrompt({
  category,
  url,
}: InferSchema<typeof schema>) {
  try {
    const report = await audit(url);

    const targetCategory = category ?? "all";
    const filteredFindings =
      targetCategory === "all"
        ? report.findings
        : report.findings.filter((f) => f.category === targetCategory);

    if (filteredFindings.length === 0) {
      const categoryNotice =
        targetCategory === "all" ? "" : ` under category '${targetCategory}'`;

      return `# SoraLabs Motion Audit AI Brief for ${report.url}
**Overall Grade:** Tier ${report.overallTier} (${report.overallScore}/100)

No issues found${categoryNotice}. All audited animation and scroll dynamics conform to Compositor-friendly standards.`;
    }

    const sections: string[] = [
      `# SoraLabs Motion Audit AI Refactoring Directive for ${report.url}`,
      `**Current Grade:** Tier ${report.overallTier} (${report.overallScore}/100)`,
      "",
      "## Executive Summary",
      `Detected ${filteredFindings.length} performance defect(s) affecting runtime rendering deadlines (60Hz/120Hz frame budget).`,
      "",
      "## Step-by-Step Remediation Directives",
    ];

    let index = 1;
    for (const f of filteredFindings) {
      const selectorsList = (f.selectors ?? [])
        .map((s) => `\`${s}\``)
        .join(", ");
      const selectorsLine = selectorsList
        ? `**Affected Selectors:** ${selectorsList}`
        : "";

      sections.push(
        `### Issue #${index}: [${f.severity.toUpperCase()}] ${f.title}`,
        `**Category:** \`${f.category}\` | **Viewport:** \`${f.viewport}\``,
        `**Diagnostic Evidence:** ${f.description}`,
        selectorsLine,
        `**Recommendation:** ${f.recommendation}`,
        ""
      );

      if (f.fixPrompt) {
        sections.push("#### Technical Fix Guide:", f.fixPrompt, "");
      }

      index += 1;
    }

    sections.push(
      "---",
      "## Implementation Guardrails for AI:",
      "1. Make surgical CSS/JS modifications only — preserve visual design and responsive layouts.",
      "2. Prefer GPU Compositor properties (`transform`, `opacity`) over geometry (`width`, `height`, `top`, `left`, `margin`).",
      "3. Eliminate synchronous layout thrashing (interleaved DOM reads like `offsetHeight` / `getBoundingClientRect` with writes).",
      "4. Convert passive scroll event handlers to CSS Scroll-Driven Animations or `IntersectionObserver`.",
      "5. Avoid excessive `will-change` layer promotions that cause GPU VRAM exhaustion."
    );

    return sections.filter(Boolean).join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Failed to generate remediation prompt for "${url}": ${message}`;
  }
}
