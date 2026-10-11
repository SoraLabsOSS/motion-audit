# @soralasbs/motion-audit

Independent web animation and motion performance auditor for production URLs and local development servers.

Motion Audit uses Puppeteer and Chromium to inspect animation timelines, scroll handlers, layout thrashing, compositor layers, and modeled texture memory on desktop and mobile reference viewports. It reports an operational S-to-F tier; the tier is a comparative diagnostic signal, not a W3C, Lighthouse, Core Web Vitals, or hardware certification.

## Install and run

Run it without installing globally:

```bash
npx @soralasbs/motion-audit https://example.com
npx @soralasbs/motion-audit http://localhost:3000 --ai
```

Or install it in a project:

```bash
npm install --save-dev @soralasbs/motion-audit
```

The package exposes the `motion-audit` binary:

```bash
npx motion-audit https://example.com
```

The unscoped command works when the package is installed locally because npm resolves the package's `bin` entry. For a one-off invocation from the npm registry, use the full scoped package name: `npx @soralasbs/motion-audit <url>`.

## CLI usage

```text
motion-audit <url> [options]
```

```bash
# Generate an AI remediation brief
npx @soralasbs/motion-audit https://example.com --ai

# Emit machine-readable JSON
npx @soralasbs/motion-audit https://example.com --json

# Fail CI when the overall tier is worse than A
npx @soralasbs/motion-audit https://example.com --threshold A

# Audit one viewport
npx @soralasbs/motion-audit https://example.com --desktop-only
npx @soralasbs/motion-audit https://example.com --mobile-only

# Write a badge or compact summary
npx @soralasbs/motion-audit https://example.com --badge
npx @soralasbs/motion-audit https://example.com --summary motion-audit.json
```

Options:

| Option | Description |
| --- | --- |
| `--json` | Write the complete report as JSON to stdout. |
| `--ai` | Write an AI remediation prompt for Cursor, Claude, or Copilot. |
| `--threshold <tier>` | Exit with code `1` when the result is worse than `S`, `A`, `B`, `C`, `D`, or `F`. |
| `--badge [file]` | Write an SVG badge, defaulting to `motion-audit.svg`. |
| `--summary <file>` | Write a compact JSON summary to a file. |
| `--desktop-only` | Audit the 1440x900 desktop reference viewport. |
| `--mobile-only` | Audit the 390x844 mobile reference viewport. |
| `--no-color` | Disable terminal color output. |
| `-h`, `--help` | Show usage information. |
| `-v`, `--version` | Show the package version. |

Exit codes:

- `0`: Audit completed and any threshold passed.
- `1`: The audit completed but failed the requested threshold.
- `2`: Invalid input or audit execution error.

## Chromium

Puppeteer downloads or resolves a compatible browser during installation. If Chrome is not available in the environment, install it explicitly:

```bash
bunx @puppeteer/browsers install chrome
```

For container environments without a usable sandbox, set:

```bash
MOTION_AUDIT_NO_SANDBOX=1
```

## Programmatic API

The package also exports the audit runner, browser viewport constants, report types, scoring helpers, and remediation prompt generators:

```ts
import { audit } from "@soralasbs/motion-audit";

const report = await audit("https://example.com", {
  onProgress: (message) => console.error(message),
});

console.log(report.overallTier, report.overallScore);
```

## Development

From the repository root:

```bash
bun install
bun run --cwd packages/motion-audit build
bun test packages/motion-audit/tests
bun run --cwd packages/motion-audit check-types
```

The package runs `npm run build` automatically through `prepublishOnly` before publishing, so the `dist` output is included in the package tarball.

## License

MIT
