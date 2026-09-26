"use client";

import { useDocsSearch } from "fumadocs-core/search/client";

const SEARCH_DELAY_MS = 150;

export function useCommandPaletteSearch() {
  return useDocsSearch({
    api: "/api/search",
    delayMs: SEARCH_DELAY_MS,
    type: "fetch",
  });
}

export function getSearchResults(
  data:
    | {
        content: string;
        id: string;
        type: "heading" | "page" | "text";
        url: string;
      }[]
    | "empty"
    | undefined
): {
  content: string;
  id: string;
  type: "heading" | "page" | "text";
  url: string;
}[] {
  if (!data || data === "empty") {
    return [];
  }

  return data;
}

export function matchesCommandQuery(
  searchValue: string,
  query: string
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return searchValue.toLowerCase().includes(normalized);
}
