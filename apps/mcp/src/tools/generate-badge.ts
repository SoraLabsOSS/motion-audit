import { generateSvgBadge } from "@soralasbs/motion-audit";
import type { InferSchema, ToolMetadata } from "xmcp";
import { z } from "zod";

export const schema = {
  label: z
    .string()
    .optional()
    .describe("Badge label text (default: 'motion audit')"),
  score: z.number().min(0).max(100).describe("Performance score from 0 to 100"),
  tier: z
    .enum(["S", "A", "B", "C", "D", "F"])
    .describe("Performance tier grade ('S', 'A', 'B', 'C', 'D', 'F')"),
};

export const metadata: ToolMetadata = {
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
    readOnlyHint: true,
    title: "Generate Motion Audit SVG Badge",
  },
  description:
    "Generates an SVG performance badge for GitHub READMEs, dashboards, and documentation showcasing the Motion Audit tier and score.",
  name: "generate_badge",
};

const BADGE_HEX_COLORS = {
  A: "2ea44f",
  B: "007ec6",
  C: "fe7d37",
  D: "ea580c",
  F: "e05d44",
  S: "dfb317",
} as const;

export default function generateBadge({
  label,
  score,
  tier,
}: InferSchema<typeof schema>) {
  const svg = generateSvgBadge(tier, score, { label });
  const colorHex = BADGE_HEX_COLORS[tier] ?? "dfb317";
  const markdownSnippet = `[![Motion Audit Tier](https://img.shields.io/badge/motion_audit-Tier_${tier}_·_${score}-${colorHex})](https://motion.soralabs.studio)`;

  return `# Generated Motion Audit Badge (Tier ${tier} · ${score}/100)

### Markdown Embedding:
\`\`\`markdown
${markdownSnippet}
\`\`\`

### Raw SVG Markup:
\`\`\`xml
${svg}
\`\`\`
`;
}
