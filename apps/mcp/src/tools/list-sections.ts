import type { InferSchema, ToolMetadata } from "xmcp";
import { z } from "zod";

import { DocSourceError, motionDocsSource } from "../docs/motion-docs-source";
import type { DocSection } from "../lib/llms-txt-parser";

export const schema = {
  section: z
    .string()
    .optional()
    .describe(
      "Filter to a specific section's children by section name or slug"
    ),
};

export const metadata: ToolMetadata = {
  annotations: {
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Documentation Sections",
  },
  description:
    "List the Motion Audit documentation structure showing all sections and pages (https://motion.soralabs.studio). Use this to discover available docs before searching or reading pages.",
  name: "list_sections",
};

const findSection = (
  sections: DocSection[],
  name: string
): DocSection | null => {
  const nameLower = name.toLowerCase();
  for (const section of sections) {
    if (
      section.name.toLowerCase() === nameLower ||
      section.slug === nameLower
    ) {
      return section;
    }
    const found = findSection(section.children, name);
    if (found) {
      return found;
    }
  }
  return null;
};

const formatTree = (sections: DocSection[], depth = 0): string => {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);
  for (const section of sections) {
    lines.push(
      `${indent}- **${section.name}** (${section.pageCount} pages) [slug: \`${section.slug}\`]`
    );
    if (section.children.length > 0) {
      lines.push(formatTree(section.children, depth + 1));
    }
  }
  return lines.join("\n");
};

export default async function listSections({
  section,
}: InferSchema<typeof schema>) {
  try {
    const sections = await motionDocsSource.listSections();
    if (sections.length === 0) {
      return "No sections found in the documentation.";
    }

    if (section) {
      const target = findSection(sections, section);
      if (!target) {
        const available = sections
          .map((s) => `  - ${s.name} [${s.slug}]`)
          .join("\n");
        return `Section "${section}" not found. Available sections:\n${available}`;
      }
      return formatTree([target], 0);
    }

    return formatTree(sections, 0);
  } catch (error) {
    if (error instanceof DocSourceError) {
      return `Failed to list sections: ${error.message}`;
    }
    throw error;
  }
}
