import path from "node:path";

import "./env";
import { fileURLToPath } from "node:url";

import bundleAnalyzer from "@next/bundle-analyzer";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

import { buildDocRedirects } from "./lib/docs/build-doc-redirects";

const withMDX = createMDX();
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});
const appRoot = import.meta.dirname;

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
  async headers() {
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
        // Static fonts (immutable long-term caching)
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        // Static images
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { hostname: "ui.aceternity.com" },
      { hostname: "ui.paceui.com" },
      { hostname: "ph-files.imgix.net" },
      { hostname: "headlessui.com" },
      { hostname: "cdn.prod.website-files.com" },
      { hostname: "images.unsplash.com" },
      { hostname: "plus.unsplash.com" },
      { hostname: "cdn.soralabs.studio", pathname: "/**", protocol: "https" },
      { hostname: "avatars.githubusercontent.com" },
    ],
  },
  reactCompiler: true,
  reactStrictMode: false,
  async redirects() {
    return [
      {
        destination: "https://ui.soralabs.studio/",
        has: [{ type: "host", value: "ui.soralabs.io.vn" }],
        permanent: true,
        source: "/",
      },
      {
        destination: "https://ui.soralabs.studio/:path*",
        has: [{ type: "host", value: "ui.soralabs.io.vn" }],
        permanent: true,
        source: "/:path*",
      },
      ...buildDocRedirects(appRoot),
    ];
  },
  async rewrites() {
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
  transpilePackages: [
    "@t3-oss/env-core",
    "@t3-oss/env-nextjs",
    "@workspace/ui",
  ],
};

export default withBundleAnalyzer(withMDX(nextConfig));
