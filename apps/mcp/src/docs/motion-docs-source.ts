import { readFileSync } from "node:fs";

import type { DocPage, DocSection } from "../lib/llms-txt-parser";
import { parseLlmsTxt } from "../lib/llms-txt-parser";
import { getLocalContentFile } from "../lib/monorepo";
import type { SearchResultItem } from "../lib/tokens";
import { DocSourceError } from "./doc-source-error";
import { docsCache } from "./docs-cache";

export { DocSourceError } from "./doc-source-error";

const BASE_URL_CLEAN_REGEX = /\/+$/u;
const QUERY_SPLIT_REGEX = /\s+/u;

/** Hardcoded docs URL for Motion Audit documentation */
export const DOCS_BASE_URL = "https://motion.soralabs.studio";

const MOTION_DOCS = {
  llmsFullTxtPath: "/llms-full.txt",
  llmsTxtPath: "/llms.txt",
  searchEndpoint: "/api/search",
} as const;

export interface DocSearchOptions {
  limit?: number;
  section?: string;
}

export type DocSearchResult = SearchResultItem & {
  description?: string;
  score?: number;
};

const LEADING_SLASHES = /^\/+/u;
const TRAILING_SLASHES = /\/+$/u;
const DOCS_PREFIX = /^docs\//u;
const FIRST_HEADING = /^#\s+(?<title>.+)$/mu;
const FRONTMATTER_TITLE_REGEX = /^title:\s*["']?(?<title>[^"'\r\n]+)["']?/mu;
const HEADER_PATTERN =
  /^#\s+(?<title>[^\n(]+?)(?:\s*\((?<url>[^)]+)\))?\s*$/gmu;

const trimSlug = (slug: string): string =>
  slug.replace(LEADING_SLASHES, "").replace(TRAILING_SLASHES, "");

const cacheKeyForSlug = (trimmedSlug: string): string =>
  trimmedSlug.replace(DOCS_PREFIX, "");

const countOccurrences = (text: string, term: string): number => {
  let count = 0;
  let pos = text.indexOf(term, 0);
  while (pos !== -1) {
    count += 1;
    pos = text.indexOf(term, pos + term.length);
  }
  return count;
};

const titleFromSlug = (slug: string): string => {
  const last = slug.split("/").pop() || slug;
  return last
    .replaceAll(/[-_]/gu, " ")
    .replaceAll(/\b\w/gu, (c) => c.toUpperCase());
};

const extractMdxTitle = (content: string, fallbackSlug: string): string =>
  content.match(FRONTMATTER_TITLE_REGEX)?.groups?.title?.trim() ??
  content.match(FIRST_HEADING)?.groups?.title?.trim() ??
  titleFromSlug(fallbackSlug);

const extractSnippet = (content: string, queryTerms: string[]): string => {
  const contentLower = content.toLowerCase();
  let bestPos = -1;

  for (const term of queryTerms) {
    const pos = contentLower.indexOf(term);
    if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
      bestPos = pos;
    }
  }

  if (bestPos === -1) {
    return content.slice(0, 200);
  }

  const snippetStart = Math.max(0, bestPos - 80);
  const snippetEnd = Math.min(content.length, bestPos + 120);
  let snippet = content.slice(snippetStart, snippetEnd).trim();

  if (snippetStart > 0) {
    snippet = `...${snippet}`;
  }
  if (snippetEnd < content.length) {
    snippet = `${snippet}...`;
  }

  return snippet;
};

interface PageBlock {
  content: string;
  description?: string;
  section?: string;
  slug: string;
  title: string;
  url: string;
}

const splitIntoPageBlocks = (fullContent: string): PageBlock[] => {
  const blocks: PageBlock[] = [];
  const matches: { index: number; title: string; url: string }[] = [];
  let match: RegExpExecArray | null = HEADER_PATTERN.exec(fullContent);

  while (match !== null) {
    matches.push({
      index: match.index,
      title: match.groups?.title?.trim() || "",
      url: match.groups?.url?.trim() || "",
    });
    match = HEADER_PATTERN.exec(fullContent);
  }

  for (let i = 0; i < matches.length; i += 1) {
    const start =
      matches[i].index + fullContent.slice(matches[i].index).indexOf("\n") + 1;
    const end =
      i + 1 < matches.length ? matches[i + 1].index : fullContent.length;
    const content = fullContent.slice(start, end).trim();
    const slug = trimSlug(matches[i].url);

    blocks.push({
      content,
      slug,
      title: matches[i].title,
      url: matches[i].url,
    });
  }

  return blocks;
};

const fetchUrlText = async (url: string, timeoutMs = 4000): Promise<string> => {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/markdown, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": "MotionAudit-MCP/1.0",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new DocSourceError(
        `Fetch failed: ${url} (${response.status} ${response.statusText})`
      );
    }
    return await response.text();
  } catch (error) {
    if (error instanceof DocSourceError) {
      throw error;
    }
    throw new DocSourceError(
      `Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
};

interface SearchApiItem {
  content?: string;
  id?: string;
  structured?: { heading?: string };
  url?: string;
}

const performLocalSearch = (
  fullContent: string,
  query: string,
  section: string | undefined,
  limit: number
): DocSearchResult[] => {
  const pageBlocks = splitIntoPageBlocks(fullContent);
  const queryTerms = query
    .toLowerCase()
    .split(QUERY_SPLIT_REGEX)
    .filter((t) => t.length > 0);

  if (queryTerms.length === 0) {
    return [];
  }

  const scored: DocSearchResult[] = [];

  for (const block of pageBlocks) {
    const matchesSection =
      !section || block.section?.toLowerCase() === section.toLowerCase();

    if (matchesSection) {
      const contentLower = block.content.toLowerCase();
      const titleLower = block.title.toLowerCase();

      let score = 0;
      let matchCount = 0;

      for (const term of queryTerms) {
        const titleMatches = countOccurrences(titleLower, term);
        const contentMatches = countOccurrences(contentLower, term);
        if (titleMatches > 0 || contentMatches > 0) {
          matchCount += 1;
          score += titleMatches * 3 + contentMatches;
        }
      }

      if (matchCount > 0) {
        const normalizedScore = Math.min(
          1,
          (matchCount / queryTerms.length) * 0.5 + score / (score + 10)
        );

        const snippet = extractSnippet(block.content, queryTerms);
        scored.push({
          description: block.description,
          score: normalizedScore,
          section: block.section,
          slug: block.slug,
          snippet,
          title: block.title,
          url: block.url,
        });
      }
    }
  }

  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return scored.slice(0, limit);
};

export class MotionDocsSource {
  readonly baseUrl: string;
  private readonly cache = docsCache;

  constructor(baseUrl: string = DOCS_BASE_URL) {
    this.baseUrl = baseUrl.replace(BASE_URL_CLEAN_REGEX, "");
  }

  async getIndex(): Promise<string> {
    const cacheKey = `index:${this.baseUrl}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const url = `${this.baseUrl}${MOTION_DOCS.llmsTxtPath}`;
    const content = await fetchUrlText(url);
    this.cache.set(cacheKey, content);
    return content;
  }

  async getFullContent(): Promise<string> {
    const cacheKey = `full:${this.baseUrl}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    const url = `${this.baseUrl}${MOTION_DOCS.llmsFullTxtPath}`;
    const content = await fetchUrlText(url);
    this.cache.set(cacheKey, content);
    return content;
  }

  async listSections(): Promise<DocSection[]> {
    const cacheKey = `sections:${this.baseUrl}`;
    const cached = this.cache.get<DocSection[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const index = await this.getIndex();
      const { sections } = parseLlmsTxt(index, this.baseUrl);
      this.cache.set(cacheKey, sections);
      return sections;
    } catch {
      // Fallback: default known sections if offline
      return [
        {
          children: [],
          name: "Documentation",
          pageCount: 3,
          slug: "docs",
          url: `${this.baseUrl}/docs`,
        },
        {
          children: [],
          name: "Methodology",
          pageCount: 11,
          slug: "methodology",
          url: `${this.baseUrl}/docs/methodology`,
        },
      ];
    }
  }

  async search(
    query: string,
    options?: DocSearchOptions
  ): Promise<DocSearchResult[]> {
    const limit = Math.min(options?.limit ?? 10, 25);
    const section = options?.section;
    const cacheKey = `search:${query}:${section ?? ""}:${limit}`;
    const cached = this.cache.get<DocSearchResult[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const results = await this.fumadocsSearch(query, section, limit);
      this.cache.set(cacheKey, results);
      return results;
    } catch {
      // Fall back to local search in llms-full.txt
      try {
        const fullContent = await this.getFullContent();
        const results = performLocalSearch(fullContent, query, section, limit);
        this.cache.set(cacheKey, results);
        return results;
      } catch (error) {
        throw new DocSourceError(
          `Search failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  private async fumadocsSearch(
    query: string,
    section: string | undefined,
    limit: number
  ): Promise<DocSearchResult[]> {
    const params = new URLSearchParams({ query });
    if (section) {
      params.set("tag", section);
    }
    const url = `${this.baseUrl}${MOTION_DOCS.searchEndpoint}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new DocSourceError(
        `Fumadocs search returned ${response.status} ${response.statusText}`
      );
    }

    // SAFETY: Fumadocs search endpoint returns an array of SearchApiItem objects
    const data = (await response.json()) as SearchApiItem[];

    if (!Array.isArray(data)) {
      throw new DocSourceError("Search API response is not an array");
    }

    return data.slice(0, limit).map((item, index) => {
      const slug = item.url ? trimSlug(item.url) : (item.id ?? "");
      const pageUrl = item.url?.startsWith("http")
        ? item.url
        : `${this.baseUrl}${item.url || item.id}`;

      return {
        score: 1 - index / Math.max(data.length, 1),
        section: item.structured?.heading,
        slug,
        snippet: item.content?.slice(0, 200) || "",
        title: item.structured?.heading || titleFromSlug(slug),
        url: pageUrl,
      };
    });
  }

  private async tryFetchCandidates(
    trimmedSlug: string,
    candidates: string[]
  ): Promise<DocPage | null> {
    const cleanPath = trimmedSlug.startsWith("docs/")
      ? trimmedSlug.slice("docs/".length)
      : trimmedSlug;

    const results = await Promise.allSettled(
      candidates.map((path) => fetchUrlText(`${this.baseUrl}${path}`, 3000))
    );

    for (const res of results) {
      if (res.status === "fulfilled") {
        return {
          content: res.value,
          slug: cacheKeyForSlug(trimmedSlug),
          title: extractMdxTitle(res.value, trimmedSlug),
          url: `${this.baseUrl}/docs/${cleanPath}`,
        };
      }
    }

    return null;
  }

  async getPage(slug: string): Promise<DocPage | null> {
    const trimmedSlug = trimSlug(slug);
    const cacheKey = `page:${cacheKeyForSlug(trimmedSlug)}`;
    const cached = this.cache.get<DocPage>(cacheKey);

    if (cached !== null) {
      return cached;
    }

    // 1. LOCAL-FIRST: Check local monorepo MDX file first (instant 0ms, offline capable)
    const local = getLocalContentFile(trimmedSlug);
    if (local) {
      try {
        const content = readFileSync(local.filePath, "utf-8");
        const title = extractMdxTitle(content, trimmedSlug);
        const page: DocPage = {
          content,
          slug: cacheKeyForSlug(trimmedSlug),
          title,
          url: `${this.baseUrl}${local.pagePath}`,
        };
        this.cache.set(cacheKey, page);
        return page;
      } catch {
        // Fall through to remote fetch
      }
    }

    // 2. REMOTE FETCH
    const cleanPath = trimmedSlug.startsWith("docs/")
      ? trimmedSlug.slice("docs/".length)
      : trimmedSlug;

    const candidates = [`/llms.mdx/${cleanPath}`, `/llms.mdx/${trimmedSlug}`];

    const remotePage = await this.tryFetchCandidates(trimmedSlug, candidates);
    if (remotePage) {
      this.cache.set(cacheKey, remotePage);
      return remotePage;
    }

    // 3. Fallback: search in llms-full.txt
    try {
      const fullContent = await this.getFullContent();
      const blocks = splitIntoPageBlocks(fullContent);
      for (const block of blocks) {
        if (
          block.slug === trimmedSlug ||
          block.url.endsWith(`/${trimmedSlug}`)
        ) {
          const page: DocPage = {
            content: block.content,
            section: block.section,
            slug: trimmedSlug,
            title: block.title,
            url: block.url,
          };
          this.cache.set(cacheKey, page);
          return page;
        }
      }
    } catch {
      // Ignore
    }

    return null;
  }
}

export const motionDocsSource = new MotionDocsSource();
