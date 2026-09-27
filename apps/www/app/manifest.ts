import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ffffff",
    description: SITE_DESCRIPTION,
    display: "standalone",
    icons: [
      {
        sizes: "192x192",
        src: "/android-chrome-192x192.png",
        type: "image/png",
      },
      {
        sizes: "512x512",
        src: "/android-chrome-512x512.png",
        type: "image/png",
      },
    ],
    id: SITE_URL,
    name: "Motion Audit",
    short_name: "Motion Audit",
    start_url: "/",
    theme_color: "#121212",
  };
}
