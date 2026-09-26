import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import remarkReadingTime from "remark-reading-time";
import { z } from "zod/v4";

import { gitLastModifiedForFile } from "./lib/docs/git-last-modified";

const catalogDocSchema = frontmatterSchema.extend({
  alpha: z.boolean().optional(),
  author: z
    .object({
      name: z.string(),
      url: z.string().optional(),
    })
    .optional(),
  beta: z.boolean().optional(),
  /** Gallery card poster + hover video preview assets. */
  cardPreview: z
    .object({
      poster: z.string().optional(),
      videoMp4: z.string().optional(),
      videoWebm: z.string().optional(),
    })
    .optional(),
  deprecated: z.boolean().optional(),
  /** Registry preview entry override (e.g. demo-*). */
  preview: z.string().optional(),
  /** @deprecated Use `cardPreview.videoMp4`. */
  previewVideo: z.string().optional(),
  /** Registry item name when it differs from the MDX slug. */
  registryName: z.string().optional(),
  /** Overrides git `lastModified` for the 10-day "new" badge only. */
  releaseDate: z.coerce.date().optional(),
  updated: z.boolean().optional(),
});

const catalogDocPostprocess = {
  includeProcessedMarkdown: true,
} as const;

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  docs: {
    postprocess: catalogDocPostprocess,
    schema: catalogDocSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

/**
 * `valueToExport` alone only injects the export into the compiled MDX
 * module — the runtime loader still needs `doc.passthroughs` to forward it
 * onto `page.data` (see how the built-in `lastModified` plugin does this).
 */
const readingTimePassthrough = {
  "index-file": {
    serverOptions(options: { doc?: { passthroughs?: string[] } }) {
      options.doc ??= {};
      options.doc.passthroughs ??= [];
      options.doc.passthroughs.push("readingTime");
    },
  },
  name: "reading-time-passthrough",
};

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (v) => [rehypeKatex, ...v],
    remarkPlugins: (v) => [...v, remarkReadingTime, remarkMath],
    // remarkStructure writes to vfile.data; export it for search indexing.
    valueToExport: ["structuredData"],
  },
  plugins: [
    lastModified({ versionControl: gitLastModifiedForFile }),
    readingTimePassthrough,
  ],
});
