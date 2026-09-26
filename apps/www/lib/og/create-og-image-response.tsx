import { ImageResponse } from "next/og";

import { OgImageFrame } from "@/lib/og/og-image-frame";
import type { OgPageContent } from "@/lib/og/resolve-og-page";
import {
  getOgSfProDisplayFontData,
  OG_FONT_FAMILY,
} from "@/lib/og/sf-pro-display-font";

export async function createOgImageResponse(
  content: OgPageContent
): Promise<ImageResponse> {
  return new ImageResponse(<OgImageFrame {...content} />, {
    fonts: [
      {
        data: await getOgSfProDisplayFontData(),
        name: OG_FONT_FAMILY,
        style: "normal",
        weight: 500,
      },
    ],
    height: 630,
    width: 1200,
  });
}
