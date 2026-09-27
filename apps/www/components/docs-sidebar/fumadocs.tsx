"use client";

import { cn } from "@workspace/ui/lib/utils";
import type { PageTree } from "fumadocs-core/server";
import type { SidebarComponents } from "fumadocs-ui/components/layout/sidebar";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import type { DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import type { LinkItemType } from "fumadocs-ui/layouts/links";
import { BaseLinkItem } from "fumadocs-ui/layouts/links";
import { getLinks } from "fumadocs-ui/layouts/shared";
import { useSidebar, useTreeContext, useTreePath } from "fumadocs-ui/provider";
import { isActive } from "fumadocs-ui/utils/is-active";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import type { CSSProperties, ReactNode } from "react";

import { usePageTransition } from "@/components/page-transition/page-transition-provider";
import { Separator } from "@/lib/docs/attach-separator";

import { ThemeSwitcher } from "../animate/theme-switcher";
import { IconLogo } from "../icon-logo";
import { DocsMobileDrawer } from "./mobile-drawer";
import {
  DocsReleaseDatesProvider,
  useCheckDocsPageNew,
  useDocsPageNew,
} from "./release-dates-context";
import { useDocsShellHover } from "./shell/context";
import {
  DocsShell,
  DocsShellContent,
  DocsShellFooter,
  DocsShellHeader,
} from "./shell/layout";
import { DocsShellNavGroup } from "./shell/nav-group";
import { DocsShellNavItem } from "./shell/nav-item";
import { DocsShellSection } from "./shell/nav-section";
import { DOCS_SIDEBAR_SCROLL_VIEWPORT_ATTR } from "./shell/scroll-active-nearest";
import { closeMobileSidebar } from "./sidebar-close-lock";
import { useDismissMobileSidebarOnOutside } from "./use-dismiss-mobile-sidebar";

const getIsActive = (pathname: string, href: string) =>
  href !== undefined && isActive(href, pathname, false);
interface NavItemFlags {
  isNew?: boolean;
  new?: boolean;
}

function getNavItemLabel(item: PageTree.Item): string {
  return typeof item.name === "string" ? item.name : String(item.name ?? "");
}

function getNavItemIsNew(
  item: PageTree.Item,
  isPageNewByUrl: (url?: string) => boolean
): boolean {
  const href =
    (item as { index?: { url: string } }).index?.url ??
    (item as { url?: string }).url;
  return (
    Boolean(href && isPageNewByUrl(href)) ||
    Boolean((item as NavItemFlags).isNew ?? (item as NavItemFlags).new)
  );
}

function pageTreeNodeKey(
  item: PageTree.Node,
  index: number,
  parentKey: string
): string {
  if (item.type === "separator") {
    return `${parentKey}/sep/${encodeURIComponent(String(item.name))}/${index}`;
  }
  if (item.type === "folder") {
    return `${parentKey}/folder/${encodeURIComponent(String(item.name))}/${index}`;
  }
  const { url } = item as { url?: string };
  if (url) {
    return url;
  }
  return `${parentKey}/item/${index}`;
}

const DEFAULT_OPEN_LEVEL = 0;

function isRootFolder(
  item: PageTree.Node
): item is PageTree.Folder & { root: true } {
  return item.type === "folder" && Boolean((item as PageTree.Folder).root);
}

/** Fumadocs hoists `meta.json` `root: true` folders as context `root` on nested routes. */
function getPrimitiveRootFolders(treeRoot: PageTree.Root): PageTree.Folder[] {
  if (isRootFolder(treeRoot as PageTree.Node)) {
    return [treeRoot as PageTree.Folder];
  }

  return treeRoot.children.filter(isRootFolder);
}

/**
 * Section trees (Motion, Icons, UI) only appear after opening that section.
 * Guide pages keep the layout `links` above Menu and must not duplicate Guide links below Menu.
 */
function getPageTreeSidebarItems(
  root: PageTree.Root,
  treePath: PageTree.Node[],
  pathname?: string
): PageTree.Node[] | null {
  if (pathname && (pathname === "/docs" || pathname.startsWith("/docs/"))) {
    return null;
  }

  const sectionRoot = treePath.findLast(isRootFolder);
  if (sectionRoot) {
    return sectionRoot.children;
  }

  if (isRootFolder(root as PageTree.Node)) {
    return (root as PageTree.Folder).children;
  }

  if (root.children.some(isRootFolder)) {
    return null;
  }

  return root.children;
}

export function SidebarPageTree(props: {
  components?: Partial<SidebarComponents>;
  onNavigate?: () => void;
}) {
  const { root } = useTreeContext();
  const pathname = usePathname();
  const treePath = useTreePath();
  const { onNavigate } = props;
  const checkPageNew = useCheckDocsPageNew();

  return useMemo(() => {
    const { Separator, Item, Folder } = props.components ?? {};
    const sidebarItems = getPageTreeSidebarItems(root, treePath, pathname);
    if (!sidebarItems) {
      return null;
    }

    function renderSeparator(
      item: PageTree.Separator,
      key: string,
      i: number,
      _level: number
    ) {
      if (Separator) {
        return <Separator item={item} key={key} />;
      }
      return (
        <DocsShellSection
          className={cn(i === 0 ? "mt-1" : "mt-4")}
          key={key}
          label={
            <span className="inline-flex items-center gap-2">
              {item.icon}
              {item.name}
            </span>
          }
        >
          {null}
        </DocsShellSection>
      );
    }

    function renderFolder(
      item: PageTree.Folder,
      key: string,
      level: number,
      parentKey: string
    ) {
      const indexUrl = item.index?.url;
      const folderChildren = indexUrl
        ? item.children.filter(
            (child) => child.type !== "page" || child.url !== indexUrl
          )
        : item.children;
      const children = renderSidebarList(
        folderChildren,
        level + 1,
        `${parentKey}/${key}`
      );
      if (Folder) {
        return (
          <Folder item={item} key={key} level={level}>
            {children}
          </Folder>
        );
      }
      const defaultOpen =
        (item.defaultOpen ?? DEFAULT_OPEN_LEVEL >= level) ||
        treePath.includes(item);
      const folderIndex = item.index;
      const showIndexLink =
        folderIndex != null &&
        !item.children.some(
          (child) => child.type === "page" && child.url === folderIndex.url
        );
      return (
        <DocsShellNavGroup
          defaultOpen={defaultOpen}
          icon={item.icon}
          key={key}
          label={item.name}
        >
          {showIndexLink ? (
            <DocsShellNavItem
              href={folderIndex.url}
              isActive={getIsActive(pathname, folderIndex.url)}
              label={folderIndex.name ?? item.name}
              onClick={onNavigate}
              showConnector={false}
            />
          ) : null}
          {children}
        </DocsShellNavGroup>
      );
    }

    function renderPage(item: PageTree.Item, key: string, level: number) {
      if (Item) {
        return <Item item={item} key={key} />;
      }

      const url =
        (item as { index?: { url: string } }).index?.url ??
        (item as { url: string }).url;

      return (
        <DocsShellNavItem
          href={url}
          isActive={getIsActive(pathname, url)}
          isNew={getNavItemIsNew(item, checkPageNew)}
          key={key}
          label={getNavItemLabel(item)}
          onClick={onNavigate}
          showConnector={level === 1}
        />
      );
    }

    function renderSidebarList(
      items: PageTree.Node[],
      level: number,
      parentKey: string
    ): ReactNode[] {
      return items.flatMap((item, i) => {
        const key = pageTreeNodeKey(item, i, parentKey);
        if (item.type === "separator") {
          return renderSeparator(item, key, i, level);
        }
        if (item.type === "folder") {
          return renderFolder(item, key, level, parentKey);
        }
        return renderPage(item, key, level);
      });
    }

    return (
      <div className="mt-4">
        {renderSidebarList(sidebarItems, 1, String(root.$id ?? "tree"))}
      </div>
    );
  }, [props.components, root, pathname, treePath, onNavigate, checkPageNew]);
}

export function SidebarLinkItem({
  item,
  onNavigate,
  ...props
}: {
  item: LinkItemType & { new?: boolean };
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const linkUrl = "url" in item ? item.url : undefined;
  const isNewFromRelease = useDocsPageNew(linkUrl);

  if (item.type === "menu") {
    return (
      <DocsShellNavGroup defaultOpen icon={item.icon} label={item.text}>
        {item.items.map((child) => (
          <SidebarLinkItem
            item={child}
            key={
              "url" in child && child.url
                ? `${String((item as { url?: string }).url ?? item.text)}-${child.url}`
                : `${String((item as { url?: string }).url ?? item.text)}-${String((child as { text?: string }).text)}`
            }
            onNavigate={onNavigate}
          />
        ))}
      </DocsShellNavGroup>
    );
  }

  if (item.type === "custom") {
    return <div {...props}>{item.children as ReactNode}</div>;
  }

  if ((item as { type?: string }).type === "separator") {
    const sep = item as unknown as { icon: ReactNode; name: string };
    return (
      <DocsShellSection
        {...props}
        className={cn("!mt-2", props.className)}
        label={<Separator icon={sep.icon} name={sep.name} />}
      >
        {null}
      </DocsShellSection>
    );
  }

  const active = getIsActive(pathname, item.url);

  return (
    <DocsShellNavItem
      className={props.className}
      external={item.external}
      href={item.url}
      isActive={active}
      isNew={isNewFromRelease || Boolean((item as { new?: boolean }).new)}
      label={item.text as string}
      onClick={item.external ? undefined : onNavigate}
    />
  );
}

export const DocsSidebar = (
  all: DocsLayoutProps & {
    releaseDatesByUrl?: Record<string, string>;
    primitivesUrl?: string;
    uiUrl?: string;
  }
) => {
  const {
    footer: sidebarFooter,
    components: sidebarComponents,
    ...sidebarProps
  } = all.sidebar ?? {};
  const links = getLinks(all.links ?? [], all.githubUrl);
  const { setOpen } = useSidebar();
  const { transitionTo } = usePageTransition();
  useDismissMobileSidebarOnOutside();

  const closeMobile = () => {
    closeMobileSidebar(setOpen);
  };

  const scrollViewportSelector = `[&_[${DOCS_SIDEBAR_SCROLL_VIEWPORT_ATTR}]]:!p-0`;
  const releaseDatesByUrl = all.releaseDatesByUrl ?? {};

  const content = (
    <DocsShell className="h-full min-h-0 max-md:w-full max-md:max-w-full">
      <DocsShellHeader className="flex items-center justify-between border-b px-4 py-3 md:hidden">
        <Link
          aria-label="Motion Audit home"
          className="flex items-center gap-2 rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
          href="/"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
              return;
            }
            e.preventDefault();
            closeMobile();
            transitionTo("/", "commercial");
          }}
        >
          <IconLogo size="sm" />
          <span className="font-semibold text-sm">Motion Audit</span>
        </Link>
        <button
          aria-label="Close menu"
          className={cn(
            buttonVariants({
              className: "!size-8 [&_svg]:!size-5 text-fd-muted-foreground",
              color: "ghost",
              size: "icon-sm",
            })
          )}
          onClick={closeMobile}
          type="button"
        >
          <X />
        </button>
      </DocsShellHeader>

      <DocsShellContent
        className={cn(
          "min-h-0",
          "max-md:pt-2 [&_[data-radix-scroll-area-viewport]]:pb-4 md:[&_[data-radix-scroll-area-viewport]]:pb-14"
        )}
      >
        {links
          .filter((v) => v.type !== "icon")
          .map((item, i, list) => {
            let linkKey: string;
            if (item.type === "menu") {
              linkKey = `menu-${item.text}`;
            } else if (item.type === "custom") {
              linkKey = "custom-docs-link";
            } else if (item.url) {
              linkKey = item.url;
            } else {
              linkKey = `link-${item.text ?? "unknown"}-${i}`;
            }

            return (
              <SidebarLinkItem
                className={cn(i === list.length - 1 && "mb-1")}
                item={item}
                key={linkKey}
                onNavigate={closeMobile}
              />
            );
          })}

        <SidebarPageTree
          components={sidebarComponents}
          onNavigate={closeMobile}
        />
      </DocsShellContent>

      <DocsShellFooter>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="ms-auto flex items-center justify-end gap-1 md:hidden">
            {links
              .filter((link) => link.type === "icon")
              .map((link) => (
                <BaseLinkItem
                  aria-label={link.label}
                  className={cn(
                    buttonVariants({ color: "ghost", size: "icon" }),
                    "size-8 p-0 text-fd-muted-foreground [&_svg]:size-4.5",
                    link.url ===
                      links.filter((l) => l.type === "icon").at(-1)?.url &&
                      "me-auto"
                  )}
                  item={link}
                  key={link.url}
                >
                  {link.icon}
                </BaseLinkItem>
              ))}
            <ThemeSwitcher className="ms-2" />
          </div>
        </div>
        {sidebarFooter ? <div className="mt-2">{sidebarFooter}</div> : null}
      </DocsShellFooter>
    </DocsShell>
  );

  return (
    <DocsReleaseDatesProvider releaseDatesByUrl={releaseDatesByUrl}>
      <DocsMobileDrawer
        className={cn(scrollViewportSelector, sidebarProps.className)}
        desktopClassName={scrollViewportSelector}
        desktopStyle={
          {
            ...sidebarProps.style,
            "--fd-sidebar-margin": "0px",
            "--fd-sidebar-top":
              "calc(var(--fd-banner-height) + var(--fd-nav-height) + var(--fd-sidebar-margin, 0px))",
          } as CSSProperties
        }
        label="Docs Navigation"
        layout="responsive"
      >
        {content}
      </DocsMobileDrawer>
    </DocsReleaseDatesProvider>
  );
};
