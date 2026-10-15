import { MemoryCache } from "../lib/memory-cache";

/** Docs are static between deploys — cache aggressively across warm invocations. */
// 24 hours TTL
export const DOCS_CACHE_TTL_MS = 86_400_000;
export const DOCS_CACHE_MAX_ENTRIES = 500;

export const docsCache = new MemoryCache({
  maxEntries: DOCS_CACHE_MAX_ENTRIES,
  ttlMs: DOCS_CACHE_TTL_MS,
});
