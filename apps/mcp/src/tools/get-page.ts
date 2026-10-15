import type { InferSchema, ToolMetadata } from "xmcp";
import { z } from "zod";

import { DocSourceError, motionDocsSource } from "../docs/motion-docs-source";
import { truncateToTokenBudget } from "../lib/tokens";

export const schema = {
  slug: z
    .string()
    .describe(
      'Page slug or URL path (e.g. "installation", "programmatic-api", or "methodology/cost-model")'
    ),
};

export const metadata: ToolMetadata = {
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Documentation Page",
  },
  description:
    "Retrieve the full markdown content of a Motion Audit documentation page by its slug or URL path (from https://motion.soralabs.studio).",
  name: "get_page",
};

export default async function getPage({ slug }: InferSchema<typeof schema>) {
  try {
    const page = await motionDocsSource.getPage(slug);
    if (!page) {
      return `Page not found: "${slug}". Use search_docs to find the correct page or list_sections to browse available documentation.`;
    }

    const header = `# ${page.title}\nURL: ${page.url}\n\n`;
    const fullContent = header + page.content;
    const { text } = truncateToTokenBudget(fullContent, 8000);
    return text;
  } catch (error) {
    if (error instanceof DocSourceError) {
      return `Failed to retrieve page: ${error.message}`;
    }
    throw error;
  }
}
