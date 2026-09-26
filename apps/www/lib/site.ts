import type { Metadata } from "next";

/** Production site origin — used for sitemap, robots, metadata, and JSON-LD. */
export const SITE_URL = "https://ui.soralabs.studio" as const;

function toAbsoluteSiteUrl(pathname: string): string {
  if (pathname === "/" || pathname === "") {
    return SITE_URL;
  }

  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

/**
 * Self-referencing canonical + hreflang (en + x-default).
 */
export function getPageAlternates(
  pathname: string
): NonNullable<Metadata["alternates"]> {
  let canonical = pathname;
  if (pathname === "") {
    canonical = "/";
  } else if (!pathname.startsWith("/")) {
    canonical = `/${pathname}`;
  }

  const href = toAbsoluteSiteUrl(canonical);

  return {
    canonical: href,
    languages: {
      en: href,
      "x-default": href,
    },
  };
}

export const CONTACT_EMAIL = "" as const;
export const SUPPORT_EMAIL = CONTACT_EMAIL;

export const GITHUB_REPO_URL =
  "https://github.com/SoraLabsOSS/motion-audit" as const;
export const GITHUB_PROFILE_URL = GITHUB_REPO_URL;
export const X_PROFILE_URL = "" as const;

/** Public community hub — bug reports, discussions, and feature requests. */
export const COMMUNITY_REPO_URL =
  "https://github.com/SoraLabsOSS/motion-audit" as const;
export const COMMUNITY_ISSUES_URL =
  "https://github.com/SoraLabsOSS/motion-audit/issues/new" as const;
export const COMMUNITY_DISCUSSIONS_URL =
  "https://github.com/SoraLabsOSS/motion-audit/discussions" as const;

export const SITE_DESCRIPTION = "";

/** Default OG image headline */
export const SITE_OG_HERO_TITLE = "";

/** OG image subline */
export const SITE_OG_HERO_SUBLINE = "";

/**
 * Origin for resolving metadata and OG image URLs.
 */
export function getMetadataBaseUrl(): string {
  if (process.env.VERCEL_ENV === "production") {
    return SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NODE_ENV === "development") {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  }

  return SITE_URL;
}
