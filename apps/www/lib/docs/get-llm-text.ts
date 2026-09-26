import type { InferPageType } from "fumadocs-core/source";

import { expandLlmMarkdown } from "@/lib/docs/expand-llm-markdown";
import type { source } from "@/lib/docs/source";

type LLMPage = InferPageType<typeof source>;

const FRONTMATTER_RE = /^---[\s\S]*?---\s*/;
const TITLE_RE = /^title:\s*["']?([^"'\n]+)["']?/m;

export async function getLLMText(page: LLMPage) {
  let processed = "";
  let raw = "";

  try {
    processed = await (page.data as any).getText("processed");
  } catch {
    raw = await (page.data as any).getText("raw");
    processed = raw.replace(FRONTMATTER_RE, "");
  }

  const title =
    (page.data as any).title ||
    (raw ? raw.match(TITLE_RE)?.[1] : undefined) ||
    "Document";
  const body = expandLlmMarkdown(processed);

  return `# ${title} (${page.url})

${body}`;
}
