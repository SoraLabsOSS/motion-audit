import type { InferPageType } from "fumadocs-core/source";

import type { source } from "@/lib/docs/source";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

type DocsPage = InferPageType<typeof source>;

function formatPageLine(page: DocsPage): string {
  const description = page.data.description?.trim();
  const suffix = description ? `: ${description}` : "";
  const title = page.data.title || page.slugs.at(-1) || "Documentation";
  return `- [${title}](${SITE_URL}${page.url})${suffix}`;
}

/** Build `llms.txt` index for static documentation pages. */
export function buildLlmsIndex(
  docsPages: DocsPage[],
  _componentPages: any[] = [],
  _uiPages: any[] = [],
  _motionPages: any[] = [],
  _iconsPages: any[] = []
): string {
  const lines = [
    "# Motion Audit",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## Documentation",
    ...docsPages.map(formatPageLine),
    "",
    "## LLM exports",
    `- [llms-full.txt](${SITE_URL}/llms-full.txt): full docs for AI`,
    `- Append \`.mdx\` to any docs URL for markdown (e.g. \`${SITE_URL}/docs/installation.mdx\`)`,
  ];

  return lines.join("\n");
}
