import "./env";
import bundleAnalyzer from "@next/bundle-analyzer";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@workspace/ui",
      "motion",
      "radix-ui",
      "fumadocs-ui",
      "lenis",
      "cmdk",
    ],
    turbopackFileSystemCacheForBuild: true,
    // Experimental native React Compiler path (Next 16.3+). Falls back to
    // babel-plugin-react-compiler if disabled; safe to try on Preview.
    turbopackRustReactCompiler: true,
  },
  headers() {
    return [
      {
        headers: [
          {
            // RFC 8288 Link headers so agents can discover the machine-
            // readable surface (llms.txt, sitemap) without parsing HTML.
            key: "Link",
            value: [
              '</llms.txt>; rel="describedby"; type="text/plain"',
              '</sitemap.xml>; rel="sitemap"; type="application/xml"',
            ].join(", "),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
        source: "/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
        source: "/fonts/:path*",
      },
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
        source: "/images/:path*",
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "cdn.soralabs.studio", pathname: "/**", protocol: "https" },
    ],
  },
  partialPrefetching: true,
  reactCompiler: true,
  reactStrictMode: false,
  rewrites() {
    return [
      // LLMs MDX / MD rewrites
      {
        destination: "/llms.mdx/:path*",
        source: "/docs/:path*.mdx",
      },
      {
        destination: "/llms.mdx/:path*",
        source: "/docs/:path*.md",
      },
      {
        destination: "/llms.mdx",
        source: "/docs.mdx",
      },
      {
        destination: "/llms.mdx",
        source: "/docs.md",
      },
    ];
  },
  transpilePackages: ["@workspace/ui"],
};

export default withBundleAnalyzer(withMDX(nextConfig));
