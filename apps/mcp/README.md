# Motion Audit MCP Server

Model Context Protocol (MCP) server for Motion Audit, built with [xmcp](https://xmcp.dev).

This server equips AI assistants (Cursor, Claude Desktop, Copilot, Windsurf) with native tools to evaluate web animation performance, detect layout thrashing, inspect CSS rendering pipeline costs, query documentation, and generate automated code remediations.

---

## Capabilities

### Tools

| Tool | Description |
| :-- | :-- |
| `audit_motion` | Audits a URL using headless Chromium across 4 core rendering engine pillars (Execution Pipeline, Scroll Dynamics, Layout Stability, GPU Memory). Returns an S-to-F tier, numerical score (0-100), and actionable findings. |
| `get_remediation_prompt` | Audits a URL and outputs an engineering-grade directive tailored for AI coding models with exact code refactoring suggestions. |
| `generate_badge` | Generates SVG badge markup and Markdown snippets displaying the current tier and score. |
| `inspect_css_property` | Evaluates CSS properties against the browser rendering pipeline (Compositor, Paint, Layout) to suggest 60fps/120fps alternatives. |
| `search_docs` | Searches Motion Audit documentation (local-first in monorepo with remote fallback to https://motion.soralabs.studio). |
| `get_page` | Retrieves full markdown content of a documentation page by slug. |
| `list_sections` | Lists table of contents and structure of the documentation. |

### Prompts

| Prompt | Description |
| :-- | :-- |
| `audit_and_fix` | Guided 4-step workflow prompt instructing an AI assistant to audit a site, analyze root causes, refactor layout-triggering code to compositor transforms, and verify the improved score. |

### Resources

| Resource | URI / Identifier | Description |
| :-- | :-- | :-- |
| Documentation Index | `motion-audit-docs` | Complete documentation table of contents and section mapping. |
| CLI & Automation Guide | `motion-audit-cli-guide` | Complete manual for terminal commands, CLI flags (`--ai`, `--json`, `--threshold`), and exit codes. |

---

## Client Configuration

### Cursor

Add to `.cursor/mcp.json` or your Cursor global MCP settings:

```json
{
  "mcpServers": {
    "motion-audit": {
      "command": "bun",
      "args": ["run", "--cwd", "E:/score/apps/mcp", "src/index.ts"]
    }
  }
}
```

Or using the compiled bundle:

```json
{
  "mcpServers": {
    "motion-audit": {
      "command": "bun",
      "args": ["E:/score/apps/mcp/dist/stdio.js"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "motion-audit": {
      "command": "bun",
      "args": ["run", "--cwd", "E:/score/apps/mcp", "src/index.ts"]
    }
  }
}
```

---

## Development & Build

### Development Mode

Run interactive MCP dev inspector:

```bash
bun run dev
```

### Type Checking & Linting

```bash
bun run check-types
bun x ultracite check apps/mcp
```

### Production Build

Compiles both STDIO and HTTP transports into `dist/`:

```bash
bun run build
```

Run compiled server:

```bash
# STDIO transport (default for AI desktop clients)
node dist/stdio.js

# HTTP transport (for network-accessible agents)
node dist/http.js
```

---

## Environment & Requirements

- Node.js >= 22.0.0 or Bun >= 1.2.0
- Chromium or Chrome (if not found, install via `bunx @puppeteer/browsers install chrome`)
- In Linux container / CI environments lacking standard user namespaces, export:
  ```bash
  export MOTION_AUDIT_NO_SANDBOX=1
  ```
