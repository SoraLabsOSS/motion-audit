# SoraLabs Motion Audit

Standards-informed web animation and motion performance auditing from SoraLabs. The repository contains the Motion Audit engine and CLI, together with the documentation site and shared workspace packages.

## Motion Audit CLI

Run an audit without installing the CLI globally:

```bash
npx @soralasbs/motion-audit https://example.com
npx @soralasbs/motion-audit http://localhost:3000 --ai
```

The CLI uses Puppeteer and Chromium to inspect animation timelines, scroll handlers, layout thrashing, compositor layers, and modeled texture memory on desktop and mobile reference viewports.

Common commands:

```bash
# Machine-readable output
npx @soralasbs/motion-audit https://example.com --json

# Generate an AI remediation brief
npx @soralasbs/motion-audit https://example.com --ai

# Fail CI when the result is worse than Tier A
npx @soralasbs/motion-audit https://example.com --threshold A

# Generate a GitHub README badge and compact report
npx @soralasbs/motion-audit https://example.com --badge
npx @soralasbs/motion-audit https://example.com --summary motion-audit.json
```

See [`packages/motion-audit/README.md`](./packages/motion-audit/README.md) for the complete CLI reference, programmatic API, Chromium setup, exit codes, and development commands.

## Documentation

The documentation site is in [`apps/www`](./apps/www). It contains the Motion Audit methodology, browser rendering research, calibration notes, and measurement-provenance boundaries.

Run it locally:

```bash
bun run dev:www
```

Then open [http://localhost:3000](http://localhost:3000).

## Repository structure

```text
apps/
└── www/                    Documentation and research site
packages/
├── motion-audit/           Auditing engine, CLI, and public API
├── ui/                     Shared UI components
└── typescript-config/      Shared TypeScript configuration
```

## Development

This is a Bun workspace managed with Turborepo. Install dependencies from the repository root:

```bash
bun install
```

Build all apps and packages:

```bash
bun run build
```

Run checks:

```bash
bun run check-types
bun run lint
```

Run Motion Audit tests and build:

```bash
bun test packages/motion-audit/tests
bun run --cwd packages/motion-audit build
bun run --cwd packages/motion-audit check-types
```

Build the documentation site:

```bash
bun run --cwd apps/www build
```

## Methodology

Motion Audit separates:

1. **Public facts** from W3C specifications, Chromium documentation, and CDP.
2. **Observable measurements** collected from a running browser.
3. **Project calibration** such as scoring weights, thresholds, and tier bands.

The S-to-F tiers are operational diagnostic signals for controlled comparisons. They are not W3C, Chromium, Lighthouse, Core Web Vitals, or hardware certifications.

Read the methodology documentation at [`apps/www/content/docs/methodology`](./apps/www/content/docs/methodology).

## License

MIT
