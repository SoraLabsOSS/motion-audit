import { CONTACT_EMAIL, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const SORA_UI_PUBLISHER_JSON_LD = {
  "@id": `${SITE_URL}/#organization`,
  "@type": "Organization",
  alternateName: "Sora Labs",
  email: CONTACT_EMAIL,
  founder: {
    "@type": "Person",
    jobTitle: "Founder",
    name: "Axyl",
    sameAs: ["https://github.com/axyl1410", "https://x.com/axyl1410"],
  },
  foundingDate: "2026-08-24",
  knowsAbout: [
    "React",
    "TypeScript",
    "Tailwind CSS",
    "Motion",
    "GSAP",
    "Animated UI components",
    "UI library",
    "shadcn/ui",
  ],
  logo: {
    "@type": "ImageObject",
    caption: "Sora UI Logo",
    height: 192,
    url: `${SITE_URL}/android-chrome-192x192.png`,
    width: 192,
  },
  name: "",
  sameAs: ["https://github.com/SoraLabsOSS/motion-audit"],
  slogan: "",
  url: SITE_URL,
} as const;

export const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": `${SITE_URL}/#website`,
      "@type": "WebSite",
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      name: "Sora UI",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      url: SITE_URL,
    },
    SORA_UI_PUBLISHER_JSON_LD,
  ],
};
