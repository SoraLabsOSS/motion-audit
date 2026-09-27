import type { Page } from "@/lib/docs/source";
import { MOTION_AUDIT_PUBLISHER_JSON_LD } from "@/lib/json-ld";
import { SITE_URL } from "@/lib/site";

function getBreadcrumbJsonLd(page: Page) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", item: SITE_URL, name: "Home", position: 1 },
      {
        "@type": "ListItem",
        item: `${SITE_URL}/docs`,
        name: "Docs",
        position: 2,
      },
      {
        "@type": "ListItem",
        item: `${SITE_URL}${page.url}`,
        name: page.data.title,
        position: 3,
      },
    ],
  };
}

export function getDocsPageJsonLd(page: Page) {
  const url = `${SITE_URL}${page.url}`;
  const modified = page.data.lastModified
    ? new Date(page.data.lastModified).toISOString()
    : undefined;

  const author = page.data.author as { name: string; url?: string } | undefined;

  const techArticle = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.data.title,
    description: page.data.description,
    url,
    mainEntityOfPage: { "@id": url, "@type": "WebPage" },
    ...(modified && { dateModified: modified, datePublished: modified }),
    ...(author && {
      author: {
        "@type": "Person",
        name: author.name,
        ...(author.url && { url: author.url }),
      },
    }),
    publisher: MOTION_AUDIT_PUBLISHER_JSON_LD,
    inLanguage: "en",
  };

  return [techArticle, getBreadcrumbJsonLd(page)];
}
