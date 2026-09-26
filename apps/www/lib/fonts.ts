import localFont from "next/font/local";

/**
 * Primary site font — SF Pro Display (Apple / Vercel style).
 * Used across the entire site (marketing, docs, components, playground).
 */
export const fontSfPro = localFont({
  display: "swap",
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
  src: [
    {
      path: "../public/fonts/sf-pro-display-cdnfonts/SFPRODISPLAYREGULAR.woff2",
      style: "normal",
      weight: "400",
    },
    {
      path: "../public/fonts/sf-pro-display-cdnfonts/SFPRODISPLAYMEDIUM.woff2",
      style: "normal",
      weight: "500",
    },
    {
      path: "../public/fonts/sf-pro-display-cdnfonts/SFPRODISPLAYBOLD.woff2",
      style: "normal",
      weight: "700",
    },
  ],
  variable: "--font-sf-pro-display",
});

/**
 * Expressive handwriting accent font — Brisa Pro.
 * Used exclusively for playful cursive scribble annotations on marketing / hero sections.
 */
export const fontBrisaPro = localFont({
  display: "swap",
  fallback: ["cursive", "sans-serif"],
  src: "../public/fonts/brisa/BrisaPro-Regular.woff2",
  style: "normal",
  variable: "--font-brisa-pro",
  weight: "400",
});
