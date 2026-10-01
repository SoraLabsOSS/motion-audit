import type { PageTree } from "fumadocs-core/server";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookOpen, FlaskConical, Folder } from "lucide-react";
import type { ReactNode } from "react";

import { source } from "@/lib/docs/source";

const SECTION_ICONS: Record<string, ReactNode> = {
  Guide: <BookOpen fill="currentColor" strokeWidth={2.5} />,
  Methodology: <FlaskConical strokeWidth={2.5} />,
};

const getPageTitle = (url: string, fallback: ReactNode): ReactNode => {
  const pageData = source.getPageByHref(url)?.page;
  const customTitle = (pageData?.data as { sidebarTitle?: string } | undefined)
    ?.sidebarTitle;
  if (customTitle) {
    return customTitle;
  }
  if (pageData?.data.title) {
    return pageData.data.title;
  }
  if (url.endsWith("/methodology")) {
    return "Conceptual Analysis";
  }
  return fallback;
};

const getSidebarLinks = (): NonNullable<BaseLayoutProps["links"]> => {
  const tree = source.pageTree;
  const links: NonNullable<BaseLayoutProps["links"]> = [];

  const rootPages = tree.children.filter(
    (item): item is PageTree.Item => item.type === "page"
  );

  if (rootPages.length > 0) {
    links.push({
      icon: SECTION_ICONS.Guide,
      name: "Guide",
      type: "separator",
    } as unknown as NonNullable<BaseLayoutProps["links"]>[number]);

    for (const page of rootPages) {
      links.push({
        secondary: false,
        text: getPageTitle(page.url, page.name),
        url: page.url,
      });
    }
  }

  const folders = tree.children.filter(
    (item): item is PageTree.Folder => item.type === "folder"
  );

  for (const folder of folders) {
    const folderName =
      typeof folder.name === "string" ? folder.name : String(folder.name ?? "");
    const icon = SECTION_ICONS[folderName] ?? <Folder strokeWidth={2.5} />;

    links.push({
      icon,
      name: folderName,
      type: "separator",
    } as unknown as NonNullable<BaseLayoutProps["links"]>[number]);

    for (const item of folder.children) {
      if (item.type === "page") {
        links.push({
          secondary: false,
          text: getPageTitle(item.url, item.name),
          url: item.url,
        });
      }
    }
  }

  return links;
};

/**
 * Shared layout configurations
 */
export const baseOptions: BaseLayoutProps = {
  links: getSidebarLinks(),
};
