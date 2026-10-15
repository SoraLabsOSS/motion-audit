import { existsSync } from "node:fs";
import path from "node:path";

let cachedWwwPath: string | null | undefined;

const TRAILING_LEADING_SLASHES = /^\/+|\/+$/gu;
const DOCS_PREFIX_REGEX = /^docs\//u;

export interface ResolvedContentFile {
  filePath: string;
  pagePath: string;
}

const isWwwDirectory = (candidate: string): boolean =>
  existsSync(candidate) &&
  existsSync(path.join(candidate, "package.json")) &&
  existsSync(path.join(candidate, "content", "docs"));

/**
 * Attempts to locate the `apps/www` directory when running inside the monorepo.
 */
export const getLocalWwwPath = (): string | null => {
  if (cachedWwwPath !== undefined) {
    return cachedWwwPath;
  }

  // 1. Explicit env overrides if present
  if (
    process.env.MOTION_WWW_DIR &&
    isWwwDirectory(process.env.MOTION_WWW_DIR)
  ) {
    cachedWwwPath = process.env.MOTION_WWW_DIR;
    return cachedWwwPath;
  }

  // 2. Traversal upwards from cwd
  const cwd = process.cwd();
  let current = cwd;
  for (let i = 0; i < 5; i += 1) {
    const checkWww = path.join(current, "apps", "www");
    if (isWwwDirectory(checkWww)) {
      cachedWwwPath = checkWww;
      return cachedWwwPath;
    }
    if (isWwwDirectory(current)) {
      cachedWwwPath = current;
      return cachedWwwPath;
    }
    const checkSibling = path.join(current, "..", "www");
    if (isWwwDirectory(checkSibling)) {
      cachedWwwPath = path.resolve(checkSibling);
      return cachedWwwPath;
    }

    const parent = path.resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }

  cachedWwwPath = null;
  return null;
};

const normalizeDocSlug = (rawSlug: string): string | null => {
  let slug = rawSlug.trim().replaceAll(TRAILING_LEADING_SLASHES, "");
  if (
    !slug ||
    slug.includes("\0") ||
    slug.includes("..") ||
    path.normalize(slug).includes("..")
  ) {
    return null;
  }

  if (slug.startsWith("docs/")) {
    slug = slug.replace(DOCS_PREFIX_REGEX, "");
  }

  return slug;
};

/**
 * Attempts to resolve a slug to a local `.mdx` file in `apps/www/content/docs/`.
 */
export const getLocalContentFile = (
  rawSlug: string
): ResolvedContentFile | null => {
  const wwwDir = getLocalWwwPath();
  if (!wwwDir) {
    return null;
  }

  const slug = normalizeDocSlug(rawSlug);
  if (!slug) {
    return null;
  }

  const docsDir = path.resolve(wwwDir, "content", "docs");
  const candidates: ResolvedContentFile[] = [];

  const addCandidate = (relPath: string, pagePath: string) => {
    const fullPath = path.resolve(docsDir, relPath);
    const rel = path.relative(docsDir, fullPath);
    if (!(rel.startsWith("..") || path.isAbsolute(rel))) {
      candidates.push({ filePath: fullPath, pagePath });
    }
  };

  if (slug === "docs" || slug === "index") {
    addCandidate("index.mdx", "/docs");
  } else {
    // Exact file match: e.g. "installation" -> "installation.mdx"
    addCandidate(`${slug}.mdx`, `/docs/${slug}`);
    // Sub-folder index: e.g. "methodology" -> "methodology/index.mdx"
    addCandidate(path.join(slug, "index.mdx"), `/docs/${slug}`);
  }

  for (const candidate of candidates) {
    if (existsSync(candidate.filePath)) {
      return candidate;
    }
  }

  return null;
};
