import path from "node:path";
import { fileURLToPath } from "node:url";

import { loader } from "fumadocs-core/source";
import type { InferPageType } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import type { FileObject } from "next-validate-link";

import { docs } from "@/.source";
import { buildDocRedirects } from "@/lib/docs/build-doc-redirects";

export const docSource = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

type DocPage = InferPageType<typeof docSource>;
type ContentPage = DocPage;

const appRoot = path.resolve(import.meta.dirname, "../..");

export function getHeadings(page: ContentPage): string[] {
  return (page.data.toc ?? []).map((item) => item.url.slice(1));
}

export async function toFileObject(page: ContentPage): Promise<FileObject> {
  return {
    content: await page.data.getText("raw"),
    data: page.data,
    path: page.absolutePath,
    url: page.url,
  };
}

export function getAllContentFiles(): Promise<FileObject[]> {
  const pages: ContentPage[] = docSource.getPages();
  return Promise.all(pages.map((page) => toFileObject(page)));
}

export function buildPopulate() {
  return {
    "docs/[[...slug]]": docSource.getPages().map((page) => ({
      hashes: getHeadings(page),
      value: { slug: page.slugs },
    })),
  };
}

type ScannedUrls = Awaited<
  ReturnType<typeof import("next-validate-link").scanURLs>
>;

function registerContentPages(scanned: ScannedUrls): void {
  const pages: ContentPage[] = docSource.getPages();

  for (const page of pages) {
    scanned.urls.set(page.url, { hashes: getHeadings(page) });
  }
}

export function augmentScannedUrls(scanned: ScannedUrls): void {
  registerContentPages(scanned);
  scanned.urls.set("/llms.txt", {});
  scanned.urls.set("/llms-full.txt", {});

  for (const redirect of buildDocRedirects(appRoot)) {
    if (!redirect.source.includes(":path")) {
      scanned.urls.set(redirect.source, {});
    }
  }
}
