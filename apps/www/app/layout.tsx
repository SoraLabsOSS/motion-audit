import { Toaster } from "@workspace/ui/components/ui/sonner";
import { cn } from "@workspace/ui/lib/utils";
import { RootProvider } from "fumadocs-ui/provider";
import { MotionConfig } from "motion/react";
import type { Metadata } from "next";

import "katex/dist/katex.css";
import "./globals.css";
import type { ReactNode } from "react";

import { DeferredAnalytics } from "@/components/analytics-deferred";
import { CommandPaletteSearchDialog } from "@/components/command-palette/command-palette-search-dialog";
import { GlobalCursorToggle } from "@/components/global-cursor-toggle";
import { Providers } from "@/components/providers";
import { getCommandPaletteGroups } from "@/lib/command-palette/get-command-palette-items";
import { fontSfPro } from "@/lib/fonts";
import { jsonLd } from "@/lib/json-ld";
import {
  getOgMetadataImages,
  getTwitterMetadataImages,
} from "@/lib/og/og-metadata-images";
import { getMetadataBaseUrl, getPageAlternates, SITE_URL } from "@/lib/site";

const defaultOgImages = getOgMetadataImages([], "Motion Audit");
const defaultTwitterImages = getTwitterMetadataImages([]);

export const metadata: Metadata = {
  alternates: getPageAlternates("/"),
  authors: [
    {
      name: "SoraLabs",
      url: "https://github.com/SoraLabsOSS",
    },
  ],
  description:
    "Automated web animation and compositor performance evaluation engine. Audit frame rates, layout thrashing, and GPU memory pressure.",
  icons: {
    apple: [{ sizes: "180x180", url: "/apple-touch-icon.png" }],
    icon: [
      { sizes: "any", url: "/favicon.ico" },
      { sizes: "16x16", type: "image/png", url: "/favicon-16x16.png" },
      { sizes: "32x32", type: "image/png", url: "/favicon-32x32.png" },
      {
        sizes: "192x192",
        type: "image/png",
        url: "/android-chrome-192x192.png",
      },
      {
        sizes: "512x512",
        type: "image/png",
        url: "/android-chrome-512x512.png",
      },
    ],
    shortcut: ["/favicon.ico"],
  },
  keywords: [
    "motion audit",
    "animation performance",
    "web performance",
    "compositor",
    "layout thrashing",
    "gpu memory pressure",
    "frame rates",
    "motionscore",
    "soralabs",
  ],
  metadataBase: new URL(getMetadataBaseUrl()),
  openGraph: {
    description:
      "Automated web animation and compositor performance evaluation engine.",
    images: defaultOgImages,
    locale: "en_US",
    siteName: "Motion Audit",
    title: "Motion Audit — Web Motion Performance Diagnostics & Scoring",
    type: "website",
    url: SITE_URL,
  },
  publisher: "SoraLabs",
  title: {
    default: "Motion Audit — Web Motion Performance Diagnostics",
    template: "%s | Motion Audit",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@soralabs",
    description:
      "Automated web animation and compositor performance evaluation engine.",
    images: defaultTwitterImages,
    site: "@soralabs",
    title: "Motion Audit — Web Motion Performance Diagnostics",
  },
};

export const Layout = ({ children }: { children: ReactNode }) => {
  const commandGroups = getCommandPaletteGroups();

  const app = (
    <RootProvider search={{ SearchDialog: CommandPaletteSearchDialog }}>
      {children}
    </RootProvider>
  );

  return (
    <html
      className={cn(fontSfPro.variable, "font-sans")}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script injection
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          type="application/ld+json"
        />
      </head>

      <body
        className={cn(
          "flex min-h-screen flex-col"
          // Allows to make more attractive video recordings
          // 'screenshot-mode',
        )}
      >
        <MotionConfig reducedMotion="user">
          <GlobalCursorToggle />
          <Providers commandGroups={commandGroups}>
            {app}
            <Toaster />
          </Providers>
        </MotionConfig>
        <DeferredAnalytics />
      </body>
    </html>
  );
};

export default Layout;
