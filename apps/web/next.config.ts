import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  experimental: {
    turbopackFileSystemCacheForBuild: true,
    turbopackRustReactCompiler: true,
  },
  partialPrefetching: true,
  reactCompiler: true,
};

export default nextConfig;
