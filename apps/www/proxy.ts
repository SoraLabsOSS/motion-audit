import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DOCS_PATH_RE = /^\/docs(?:\/(.+))?$/;
const MOTION_PATH_RE = /^\/(?:motion|primitives)(?:\/(.+))?$/;
const ICONS_PATH_RE = /^\/icons(?:\/(.+))?$/;
const CATALOG_PATH_RE = /^\/(?:catalog|components)\/(.+)$/;
const UI_PATH_RE = /^\/ui(?:\/(.+))?$/;
const BLOG_PATH_RE = /^\/blog\/(.+)$/;
const MD_EXT_RE = /\.(mdx|md)$/;

function rewriteMarkdownPath(pathname: string): string | null {
  const clean = pathname.replace(MD_EXT_RE, "");

  const docsMatch = clean.match(DOCS_PATH_RE);
  if (docsMatch) {
    const rest = docsMatch[1];
    return rest ? `/llms.mdx/${rest}` : "/llms.mdx";
  }

  const motionMatch = clean.match(MOTION_PATH_RE);
  if (motionMatch) {
    const rest = motionMatch[1];
    return rest ? `/llms.mdx/motion/${rest}` : "/llms.mdx/motion";
  }

  const iconsMatch = clean.match(ICONS_PATH_RE);
  if (iconsMatch) {
    const rest = iconsMatch[1];
    return rest ? `/llms.mdx/icons/${rest}` : "/llms.mdx/icons";
  }

  const catalogMatch = clean.match(CATALOG_PATH_RE);
  if (catalogMatch) {
    return `/llms-catalog.mdx/${catalogMatch[1]}`;
  }

  const uiMatch = clean.match(UI_PATH_RE);
  if (uiMatch) {
    const rest = uiMatch[1];
    return rest ? `/llms-ui.mdx/${rest}` : "/llms-ui.mdx";
  }

  const blogMatch = clean.match(BLOG_PATH_RE);
  if (blogMatch) {
    return `/llms-blog.mdx/${blogMatch[1]}`;
  }

  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rewritten = rewriteMarkdownPath(pathname);
  if (!rewritten) {
    return NextResponse.next();
  }

  return NextResponse.rewrite(new URL(rewritten, request.nextUrl));
}

export const config = {
  matcher: [
    "/(docs|ui|motion|primitives|icons)/:path*.(md|mdx)",
    "/(catalog|components|blog)/:path+.(md|mdx)",
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/docs",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/docs/:path*",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/motion",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/motion/:path*",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/primitives",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/primitives/:path*",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/icons",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/icons/:path*",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/catalog/:path+",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/components/:path+",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/ui",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/ui/:path*",
    },
    {
      has: [
        {
          key: "accept",
          type: "header",
          value: ".*text/(markdown|plain).*",
        },
      ],
      source: "/blog/:path+",
    },
  ],
};
