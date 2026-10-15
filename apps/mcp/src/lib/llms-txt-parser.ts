export interface DocPage {
  content: string;
  description?: string;
  section?: string;
  slug: string;
  title: string;
  url: string;
}

export interface DocSection {
  children: DocSection[];
  name: string;
  pageCount: number;
  slug: string;
  url: string;
}

export interface ParseLlmsTxtResult {
  pages: DocPage[];
  sections: DocSection[];
}

const TRAILING_SLASHES = /\/+$/u;
const LEADING_SLASHES = /^\/+/u;
const SECTION_HEADING_REGEX = /^##\s+(?<name>.+)$/u;
const SUBSECTION_HEADING_REGEX = /^###\s+(?<name>.+)$/u;
const LINK_LINE_REGEX =
  /^-\s+\[(?<title>[^\]]+)\]\((?<url>[^)]+)\)(?::\s*(?<description>.*))?$/u;
const SLUGIFY_NON_ALPHANUM = /[^a-z0-9]+/gu;
const SLUGIFY_TRIM_DASHES = /^-+|-+$/gu;

/**
 * Convert a section name to a URL-friendly slug.
 */
const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll(SLUGIFY_NON_ALPHANUM, "-")
    .replaceAll(SLUGIFY_TRIM_DASHES, "");

/**
 * Derive a slug from a URL by stripping the base URL and leading/trailing slashes.
 */
export const deriveSlug = (url: string, baseUrl?: string): string => {
  let slug = url;
  if (baseUrl) {
    const base = baseUrl.replace(TRAILING_SLASHES, "");
    if (slug.startsWith(base)) {
      slug = slug.slice(base.length);
    }
  }

  try {
    const parsed = new URL(slug);
    slug = parsed.pathname;
  } catch {
    // Not a full URL, use as-is
  }

  return slug.replace(LEADING_SLASHES, "").replace(TRAILING_SLASHES, "");
};

const createSection = (name: string, baseUrl?: string): DocSection => {
  const trimmedName = name.trim();
  const slug = slugify(trimmedName);
  return {
    children: [],
    name: trimmedName,
    pageCount: 0,
    slug,
    url: baseUrl ? `${baseUrl}/${slug}` : slug,
  };
};

const createSubsection = (
  name: string,
  parent: DocSection,
  baseUrl?: string
): DocSection => {
  const trimmedName = name.trim();
  const slug = slugify(trimmedName);
  return {
    children: [],
    name: trimmedName,
    pageCount: 0,
    slug,
    url: baseUrl
      ? `${baseUrl}/${parent.slug}/${slug}`
      : `${parent.slug}/${slug}`,
  };
};

const createPage = (
  groups: { description?: string; title: string; url: string },
  sectionName?: string,
  baseUrl?: string
): DocPage => ({
  content: "",
  description: groups.description?.trim() || undefined,
  section: sectionName,
  slug: deriveSlug(groups.url.trim(), baseUrl),
  title: groups.title.trim(),
  url: groups.url.trim(),
});

/**
 * Parse an llms.txt index file into structured sections and pages.
 */
export const parseLlmsTxt = (
  content: string,
  baseUrl?: string
): ParseLlmsTxtResult => {
  if (!content?.trim()) {
    return { pages: [], sections: [] };
  }

  const sections: DocSection[] = [];
  const pages: DocPage[] = [];
  let currentSection: DocSection | null = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(SECTION_HEADING_REGEX);
    const subsectionMatch = trimmed.match(SUBSECTION_HEADING_REGEX);
    const linkMatch = trimmed.match(LINK_LINE_REGEX);

    if (sectionMatch?.groups?.name) {
      currentSection = createSection(sectionMatch.groups.name, baseUrl);
      sections.push(currentSection);
    } else if (subsectionMatch?.groups?.name && currentSection) {
      const sub = createSubsection(
        subsectionMatch.groups.name,
        currentSection,
        baseUrl
      );
      currentSection.children.push(sub);
    } else if (linkMatch?.groups?.title && linkMatch.groups.url) {
      const page = createPage(
        {
          description: linkMatch.groups.description,
          title: linkMatch.groups.title,
          url: linkMatch.groups.url,
        },
        currentSection?.name,
        baseUrl
      );
      pages.push(page);
      if (currentSection) {
        currentSection.pageCount += 1;
      }
    }
  }

  return { pages, sections };
};
