import type { ResourceMetadata } from "xmcp";

export const metadata: ResourceMetadata = {
  description:
    "Comprehensive guide and instruction manual for executing Motion Audit via CLI terminal commands, CI/CD pipelines, and programmatic Node.js API.",
  mimeType: "text/markdown",
  name: "motion-audit-cli-guide",
  title: "Motion Audit CLI & Automation Guide",
};

const GUIDE_CONTENT = `# Motion Audit CLI & Automation Manual

Motion Audit is an automated performance evaluation framework designed to inspect, measure, and optimize web animations, interactive UI transitions, and scroll dynamics using headless Chromium.

---

## 1. Quick Terminal Invocations

Run directly without global installation:

\`\`\`bash
# Run standard audit on local dev or production URL
npx @soralasbs/motion-audit http://localhost:3000

# Generate an AI remediation directive for Cursor, Claude, or Copilot
npx @soralasbs/motion-audit http://localhost:3000 --ai

# Emit machine-readable JSON to stdout
npx @soralasbs/motion-audit https://example.com --json

# Fail CI pipeline if score falls below Tier A (exit code 1)
npx @soralasbs/motion-audit https://example.com --threshold A

# Audit specific viewports
npx @soralasbs/motion-audit https://example.com --desktop-only
npx @soralasbs/motion-audit https://example.com --mobile-only

# Generate SVG badge for README.md
npx @soralasbs/motion-audit https://example.com --badge motion-audit.svg

# Output compact JSON summary to a file
npx @soralasbs/motion-audit https://example.com --summary motion-audit.json
\`\`\`

---

## 2. CLI Options Reference

| Option | Description |
| :--- | :--- |
| \`--ai\` | Writes an engineering remediation brief tailored for AI assistants. |
| \`--json\` | Writes complete structured report as JSON to stdout (stream isolation). |
| \`--threshold <tier>\` | Exits with code \`1\` if overall grade is worse than \`S\`, \`A\`, \`B\`, \`C\`, \`D\`, \`F\`. |
| \`--badge [file]\` | Generates SVG badge (defaults to \`motion-audit.svg\`). |
| \`--summary <file>\` | Writes compact JSON summary to specified path. |
| \`--desktop-only\` | Audits only the 1440x900 @ DPR 2 reference desktop viewport. |
| \`--mobile-only\` | Audits only the 390x844 @ DPR 3 reference mobile viewport. |
| \`--no-color\` | Disables ANSI terminal coloring (or set \`NO_COLOR=1\`). |
| \`-h\`, \`--help\` | Prints usage information. |
| \`-v\`, \`--version\` | Prints package version. |

---

## 3. Exit Codes

- **\`0\`**: Audit completed successfully and met any requested threshold.
- **\`1\`**: Audit completed but failed the requested \`--threshold\` quality gate.
- **\`2\`**: Invalid arguments, unreachable URL, or runtime execution error.

---

## 4. Container & CI/CD Environment Setup

When running in restricted Linux containers or GitHub Actions:

\`\`\`bash
# If Chromium is not installed in the environment:
bunx @puppeteer/browsers install chrome

# In container environments without standard user namespaces:
export MOTION_AUDIT_NO_SANDBOX=1
\`\`\`

---

## 5. Programmatic Node.js / TypeScript SDK

Install locally:
\`\`\`bash
npm install --save-dev @soralasbs/motion-audit
\`\`\`

Import and call in your test scripts:
\`\`\`typescript
import { audit } from "@soralasbs/motion-audit";

const report = await audit("http://localhost:3000", {
  onProgress: (msg) => console.log(msg),
});

console.log(\`Grade: Tier \${report.overallTier} (\${report.overallScore}/100)\`);
\`\`\`

---

## 6. The 4 Diagnostic Pillars

1. **Execution Pipeline Cost:** Prefers \`transform\` and \`opacity\` (compositor thread) over geometry (\`width\`/\`height\` -> layout reflow) and paint (\`box-shadow\` -> raster invalidation).
2. **Scroll Dynamics:** Eliminates continuous main-thread scroll loops; enforces passive listeners, \`IntersectionObserver\`, or CSS \`scroll-timeline\`.
3. **Layout Stability & Thrashing:** Detects interleaved DOM read/write cycles (e.g., querying \`offsetHeight\` inside continuous animation loop).
4. **GPU Memory & Layer Health:** Audits layer promotions to prevent GPU VRAM exhaustion.
`;

export default function cliGuideResource() {
  return GUIDE_CONTENT;
}
