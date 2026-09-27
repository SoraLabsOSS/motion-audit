import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DOCS_PATH_RE = /^\/docs(?:\/(.+))?$/;
const MD_EXT_RE = /\.(mdx|md)$/;

function rewriteMarkdownPath(pathname: string): string | null {
  const clean = pathname.replace(MD_EXT_RE, "");

  const docsMatch = clean.match(DOCS_PATH_RE);
  if (docsMatch) {
    const rest = docsMatch[1];
    return rest ? `/llms.mdx/${rest}` : "/llms.mdx";
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
    "/docs/:path*.(md|mdx)",
    "/docs.(md|mdx)",
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
  ],
};
