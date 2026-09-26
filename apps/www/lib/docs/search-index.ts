import type { OramaDocument } from "fumadocs-core/search/orama-cloud";
import type { AdvancedIndex } from "fumadocs-core/search/server";
import type { InferPageType } from "fumadocs-core/source";

import { source } from "@/lib/docs/source";

type SearchablePage = InferPageType<typeof source>;

function getSearchTag(page: SearchablePage): string {
  return page.slugs[0] ?? "docs";
}

function pageToAdvancedIndex(page: SearchablePage): AdvancedIndex {
  const structuredData = (page.data as any).structuredData ?? {
    contents: [],
    headings: [],
  };
  const title = (page.data as any).title ?? page.slugs.at(-1) ?? page.url;

  return {
    description: (page.data as any).description,
    id: page.url,
    structuredData,
    tag: getSearchTag(page),
    title,
    url: page.url,
  };
}

export function getSearchablePages(): SearchablePage[] {
  return source.getPages().filter((page) => page.slugs[0] !== "openapi");
}

export function getSearchIndexes(): AdvancedIndex[] {
  return getSearchablePages().map(pageToAdvancedIndex);
}

export function getStaticPageDocuments(): Omit<OramaDocument, "structured">[] {
  return getSearchablePages().map((page) => ({
    description: (page.data as any).description,
    id: page.url,
    tag: getSearchTag(page),
    title: (page.data as any).title ?? page.url,
    url: page.url,
  }));
}
