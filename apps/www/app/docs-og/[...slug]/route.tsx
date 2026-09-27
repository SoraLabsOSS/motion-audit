import { notFound } from "next/navigation";

import { source } from "@/lib/docs/source";
import { getCachedOgImageBuffer } from "@/lib/og/get-cached-og-image";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const pageSlug = slug.at(-1)?.endsWith(".png") ? slug.slice(0, -1) : slug;
  const buffer = await getCachedOgImageBuffer(pageSlug);

  if (!buffer) {
    notFound();
  }

  return new Response(buffer, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/png",
    },
  });
}

export function generateStaticParams(): {
  slug: string[];
}[] {
  const docParams = source
    .generateParams()
    .filter((page) => source.getPage(page.slug) !== null)
    .flatMap((page) => [
      { slug: [...page.slug, "image.png"] },
      ...(page.slug.length > 0 ? [{ slug: page.slug }] : []),
    ]);

  return [{ slug: ["image.png"] }, ...docParams];
}
