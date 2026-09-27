import { readFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeOgImageUrl } from "@/lib/og/assert-safe-og-image-url";
import { getMetadataBaseUrl, SITE_URL } from "@/lib/site";

const BRAND_AVATAR_PATH = "/icons/icon.png";
const brandAvatarFileName = BRAND_AVATAR_PATH.replace(/^\//, "");
const remoteDataUrls = new Map<string, Promise<string | undefined>>();

let brandAvatarDataUrl: Promise<string | undefined> | undefined;

function sniffImageMime(buffer: Buffer): "image/png" | "image/jpeg" | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "image/jpeg";
  }

  return null;
}

/** Palette PNGs (`color type 3`) make `next/og` throw "unsupported image format". */
function isIndexedPng(buffer: Buffer): boolean {
  return (
    sniffImageMime(buffer) === "image/png" &&
    buffer.length > 25 &&
    buffer[25] === 3
  );
}

function toOgDataUrl(buffer: Buffer): string | undefined {
  if (isIndexedPng(buffer)) {
    return;
  }

  const mime = sniffImageMime(buffer);
  if (!mime) {
    return;
  }

  return `data:${mime};base64,${buffer.toString("base64")}`;
}

const readBrandAvatarDataUrl = async (): Promise<string | undefined> => {
  try {
    const buffer = await readFile(
      path.join(process.cwd(), "public", brandAvatarFileName)
    );
    return toOgDataUrl(buffer);
  } catch {
    return;
  }
};

const getBrandAvatarDataUrl = async (): Promise<string | undefined> => {
  brandAvatarDataUrl ??= readBrandAvatarDataUrl();
  return await brandAvatarDataUrl;
};

function isLocalBrandAvatar(src: string): boolean {
  const brandPaths = [
    BRAND_AVATAR_PATH,
    `${SITE_URL}${BRAND_AVATAR_PATH}`,
    `${getMetadataBaseUrl()}${BRAND_AVATAR_PATH}`,
  ];

  return brandPaths.includes(src);
}

const fetchRemoteOgImage = async (src: string): Promise<string | undefined> => {
  let url: string;
  try {
    url = assertSafeOgImageUrl(src);
  } catch {
    return;
  }

  const cached = remoteDataUrls.get(url);
  if (cached) {
    return await cached;
  }

  const pending = (async (): Promise<string | undefined> => {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "image/jpeg,image/png,image/*;q=0.8",
          "User-Agent": "MotionAudit-OG/1.0",
        },
      });

      if (!response.ok) {
        remoteDataUrls.delete(url);
        return;
      }

      const dataUrl = toOgDataUrl(Buffer.from(await response.arrayBuffer()));
      if (!dataUrl) {
        remoteDataUrls.delete(url);
      }
      return dataUrl;
    } catch {
      remoteDataUrls.delete(url);
      return;
    }
  })();

  remoteDataUrls.set(url, pending);
  return await pending;
};

/**
 * Satori cannot reliably fetch images itself (localhost, GitHub UA, palette PNG).
 * Always hand `next/og` a JPEG/PNG data URL, or omit the logo.
 */
export async function resolveOgImageSrc(
  src?: string
): Promise<string | undefined> {
  if (!src) {
    return;
  }

  if (isLocalBrandAvatar(src)) {
    return await getBrandAvatarDataUrl();
  }

  return await fetchRemoteOgImage(src);
}
