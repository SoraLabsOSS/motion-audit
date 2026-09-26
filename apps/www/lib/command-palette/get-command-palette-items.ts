import { cache } from "react";

import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/docs/source";

import type { CommandPaletteGroup, CommandPaletteItem } from "./types";

function docHint(url: string): string {
  if (url === "/docs") {
    return "Docs";
  }

  const segment = url.split("/").filter(Boolean).pop() ?? "";
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function item(
  partial: Omit<CommandPaletteItem, "searchValue"> & { path?: string }
): CommandPaletteItem {
  const hint = partial.hint ?? "";
  const pathPrefix = partial.path ? `~ ${partial.path} ` : "";
  const keywords = partial.keywords?.join(" ") ?? "";

  return {
    ...partial,
    searchValue: `${pathPrefix}${partial.label} ${hint} ${keywords}`.trim(),
  };
}

const GUIDE_DOC_URLS = new Set(
  (baseOptions.links ?? [])
    .filter(
      (link): link is { text: string; url: string } =>
        typeof link === "object" &&
        link !== null &&
        "url" in link &&
        typeof link.url === "string" &&
        link.url.startsWith("/docs")
    )
    .map((link) => link.url)
);

function getDocumentationItems(): CommandPaletteItem[] {
  const documentation: CommandPaletteItem[] = [];

  for (const page of source.getPages()) {
    if (page.slugs[0] === "openapi") {
      continue;
    }

    if (
      page.url.startsWith("/docs/motion/") ||
      page.url.startsWith("/docs/primitives/") ||
      page.url.startsWith("/docs/icons")
    ) {
      continue;
    }

    if (!GUIDE_DOC_URLS.has(page.url) && page.url !== "/docs") {
      continue;
    }

    documentation.push(
      item({
        hint: docHint(page.url),
        href: page.url,
        icon: "book",
        id: `doc-${page.url}`,
        keywords: page.data.description ? [page.data.description] : undefined,
        label: page.data.title,
        path: page.url,
      })
    );
  }

  return documentation;
}

export const getCommandPaletteGroups = cache((): CommandPaletteGroup[] => {
  const navigation: CommandPaletteItem[] = [
    item({
      href: "/",
      icon: "arrow",
      id: "page-home",
      label: "Home",
      path: "/",
    }),
    item({
      href: "/docs",
      icon: "book",
      id: "page-docs",
      label: "Documentation",
      path: "/docs",
    }),
  ];

  const documentation = getDocumentationItems();

  const groups: CommandPaletteGroup[] = [
    { id: "navigation", items: navigation, label: "Navigation" },
  ];

  if (documentation.length > 0) {
    groups.push({
      id: "documentation",
      items: documentation,
      label: "Documentation",
    });
  }

  return groups;
});
