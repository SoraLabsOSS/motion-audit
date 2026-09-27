import type { InferPageType } from "fumadocs-core/source";
import type { MetadataRoute } from "next";

import { staticContentCacheLife } from "@/lib/cache/static-content-cache-life";
import { source } from "@/lib/docs/source";
import { SITE_URL } from "@/lib/site";

type ContentPage = InferPageType<typeof source>;

function toLastModified(value: Date | string | number | undefined) {
  if (!value) {
    return;
  }

  return new Date(value);
}

function getLatestLastModified(
  pages: readonly { data: { lastModified?: Date | string | number } }[]
) {
  let latest: Date | undefined;

  for (const page of pages) {
    const date = toLastModified(page.data.lastModified);
    if (date && (!latest || date > latest)) {
      latest = date;
    }
  }

  return latest;
}

function contentPageToEntry(
  page: ContentPage,
  priority: number
): MetadataRoute.Sitemap[number] {
  return {
    changeFrequency: "weekly",
    lastModified: toLastModified(page.data.lastModified),
    priority,
    url: `${SITE_URL}${page.url}`,
  };
}

async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  staticContentCacheLife();

  const docPages = source
    .getPages()
    .filter((page) => page.slugs[0] !== "openapi");
  const docEntries = docPages.map((page) =>
    contentPageToEntry(page, page.url === "/docs" ? 0.9 : 0.7)
  );
  const latestDocDate = getLatestLastModified(docPages);

  const rawEntries: MetadataRoute.Sitemap = [
    {
      changeFrequency: "weekly",
      lastModified: latestDocDate,
      priority: 1,
      url: SITE_URL,
    },
    ...docEntries,
  ];

  // Deduplicate by URL while preserving the highest priority entry
  const entryMap = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of rawEntries) {
    const existing = entryMap.get(entry.url);
    if (!existing || (entry.priority ?? 0) > (existing.priority ?? 0)) {
      entryMap.set(entry.url, entry);
    }
  }

  return await Promise.resolve([...entryMap.values()]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return await buildSitemap();
}
