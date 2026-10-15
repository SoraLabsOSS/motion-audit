import type { InferSchema, ToolMetadata } from "xmcp";
import { z } from "zod";

import { DocSourceError, motionDocsSource } from "../docs/motion-docs-source";
import type { DocSearchResult } from "../docs/motion-docs-source";
import { formatSearchResults } from "../lib/tokens";

export const schema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("Maximum number of results to return (default 10, max 25)"),
  query: z
    .string()
    .describe(
      "Search query — keywords or phrase to find in the Motion Audit documentation"
    ),
  section: z
    .string()
    .optional()
    .describe(
      "Filter results to a specific documentation section (e.g. 'docs' or 'methodology')"
    ),
};

export const metadata: ToolMetadata = {
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    readOnlyHint: true,
    title: "Search Documentation",
  },
  description:
    "Search the Motion Audit documentation (https://motion.soralabs.studio) by keyword or phrase. Returns a ranked list of matching pages with relevant excerpts.",
  name: "search_docs",
};

export default async function searchDocs({
  query,
  section,
  limit,
}: InferSchema<typeof schema>) {
  try {
    const searchLimit = limit ?? 10;
    const results: DocSearchResult[] = await motionDocsSource.search(query, {
      limit: searchLimit,
      section,
    });
    const formatted = formatSearchResults(results, 4000);

    if (results.length === searchLimit) {
      return `${formatted}\n\n(Note: results may be truncated at ${searchLimit} — refine your query or raise \`limit\` for more.)`;
    }

    return formatted;
  } catch (error) {
    if (error instanceof DocSourceError) {
      return `Search failed: ${error.message}. Try again or use list_sections to browse available documentation.`;
    }
    throw error;
  }
}
