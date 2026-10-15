import type { InferSchema, PromptMetadata } from "xmcp";
import { z } from "zod";

export const schema = {
  targetTier: z
    .enum(["S", "A", "B"])
    .optional()
    .describe("Target performance tier (default: 'A')"),
  url: z
    .string()
    .describe(
      "Webpage URL to audit and optimize (e.g. 'http://localhost:3000')"
    ),
};

export const metadata: PromptMetadata = {
  description:
    "Workflow prompt instructing AI to audit a web page, diagnose animation & motion bottlenecks across the 4 pillars, and refactor code to achieve Tier A or Tier S.",
  name: "audit_and_fix",
  role: "user",
  title: "Audit and Fix Web Animation Performance",
};

export default function auditAndFixPrompt({
  targetTier = "A",
  url,
}: InferSchema<typeof schema>) {
  return `You are a Senior Web Animation & Performance Optimization Engineer.

Please execute a full Motion Performance Audit on the target website:
URL: ${url}
Target Quality Threshold: Tier ${targetTier}

---

### Step 1: Run the Motion Audit
Use the MCP tool \`audit_motion\` with \`url: "${url}"\`, or alternatively run via terminal CLI:
\`\`\`bash
npx @soralabs/motion-audit ${url} --ai
\`\`\`

---

### Step 2: Evaluate the 4 Engineering Pillars
Examine the report across the core rendering engine pillars:
1. **Execution Pipeline Cost:**
   - Detect animations modifying geometry (\`width\`, \`height\`, \`top\`, \`left\`, \`margin\`) or paint properties (\`box-shadow\`, \`background-color\`).
   - Use the \`inspect_css_property\` tool to check replacement candidate properties.
2. **Scroll Dynamics:**
   - Detect non-passive scroll event listeners and scroll-linked main thread calculations.
   - Refactor to CSS Scroll-Driven Animations (\`animation-timeline: scroll()\`) or \`IntersectionObserver\`.
3. **Layout Stability & Thrashing:**
   - Detect interleaved DOM reads (\`offsetHeight\`, \`getBoundingClientRect\`, \`scrollTop\`) with DOM writes during animation/scroll loops.
   - Batch DOM reads before writes or calculate dimensions once outside loops.
4. **GPU Memory & Layer Health:**
   - Identify excessive layer promotions (unnecessary \`will-change\`) and massive raster surfaces elevating VRAM.

---

### Step 3: Implement Surgical Code Patches
- For every finding with severity \`critical\` or \`high\`, read its \`fixPrompt\` and apply the minimum necessary code modification.
- Never regress visual aesthetics or user interactions.
- Convert layout-triggering keyframes to compositor transforms (\`transform: translate3d/scale3d\`).

---

### Step 4: Verification
Re-run the audit to ensure the site meets or exceeds Tier ${targetTier}.
`;
}
