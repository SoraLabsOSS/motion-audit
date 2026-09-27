import { source } from "@/lib/docs/source";
import {
  SITE_DESCRIPTION,
  SITE_OG_HERO_SUBLINE,
  SITE_OG_HERO_TITLE,
} from "@/lib/site";

export interface OgPageContent {
  description?: string;
  title: string;
}

const SITE_DEFAULT: OgPageContent = {
  description: `${SITE_OG_HERO_SUBLINE}. ${SITE_DESCRIPTION}`,
  title: SITE_OG_HERO_TITLE,
};

/**
 * Resolve title/description for `/docs-og/[...slug]/image.png`.
 * Slug is the path segments before `image.png`.
 */
export function resolveOgPage(slug: string[]): OgPageContent | null {
  if (slug.length === 0) {
    const rootPage = source.getPage([]);
    if (rootPage) {
      return {
        description: rootPage.data.description,
        title: rootPage.data.title,
      };
    }
    return SITE_DEFAULT;
  }

  if (slug.length === 1 && slug[0] === "index") {
    const indexPage = source.getPage([]);
    if (indexPage) {
      return {
        description: indexPage.data.description,
        title: indexPage.data.title,
      };
    }
  }

  if (slug[0] === "docs" && slug.length > 1) {
    const page = source.getPage(slug.slice(1));
    if (page) {
      return {
        description: page.data.description,
        title: page.data.title,
      };
    }
  }

  const page = source.getPage(slug);
  if (!page) {
    return SITE_DEFAULT;
  }

  return {
    description: page.data.description,
    title: page.data.title,
  };
}
