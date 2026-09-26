import { normalizeBookmarkUrl } from "@/lib/bookmarks/url";
import { source } from "@/lib/docs/source";

export function getBookmarkableUrls(): Set<string> {
  const docsUrls = source
    .getPages()
    .filter((page) => page.slugs[0] !== "openapi")
    .map((page) => page.url);

  return new Set(docsUrls);
}

let validBookmarkUrls: Set<string> | undefined;

function refreshBookmarkUrlCache(): Set<string> {
  validBookmarkUrls = getBookmarkableUrls();
  return validBookmarkUrls;
}

function getCachedBookmarkUrls(): Set<string> {
  if (!validBookmarkUrls) {
    return refreshBookmarkUrlCache();
  }

  return validBookmarkUrls;
}

function resolveBookmarkUrlFromSet(
  url: string,
  urls: ReadonlySet<string>
): string | null {
  if (urls.has(url)) {
    return url;
  }

  const normalized = normalizeBookmarkUrl(url);
  if (urls.has(normalized)) {
    return normalized;
  }

  return null;
}

export function resolveBookmarkUrl(url: string): string | null {
  let urls = getCachedBookmarkUrls();
  let resolved = resolveBookmarkUrlFromSet(url, urls);

  if (!resolved) {
    urls = refreshBookmarkUrlCache();
    resolved = resolveBookmarkUrlFromSet(url, urls);
  }

  return resolved;
}
