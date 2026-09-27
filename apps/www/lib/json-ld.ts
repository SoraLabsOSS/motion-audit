import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const MOTION_AUDIT_PUBLISHER_JSON_LD = {
  "@id": `${SITE_URL}/#organization`,
  "@type": "Organization",
  alternateName: "SoraLabs",
  email: CONTACT_EMAIL,
  foundingDate: "2026-08-24",
  knowsAbout: [
    "Web Performance",
    "Animation Performance",
    "Browser Compositor",
    "Frame Rate Diagnostics",
    "Layout Thrashing",
    "GPU Texture Allocation",
    "TypeScript",
  ],
  logo: {
    "@type": "ImageObject",
    caption: "Motion Audit Logo",
    height: 192,
    url: `${SITE_URL}/android-chrome-192x192.png`,
    width: 192,
  },
  name: "Motion Audit",
  sameAs: ["https://github.com/SoraLabsOSS/motion-audit"],
  slogan:
    "Automated web animation and compositor performance evaluation engine",
  url: SITE_URL,
} as const;

export const SORA_UI_PUBLISHER_JSON_LD = MOTION_AUDIT_PUBLISHER_JSON_LD;

export const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": `${SITE_URL}/#website`,
      "@type": "WebSite",
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      name: "Motion Audit",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      url: SITE_URL,
    },
    MOTION_AUDIT_PUBLISHER_JSON_LD,
  ],
};
