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

const docSchema = frontmatterSchema.extend({
  author: z
    .object({
      name: z.string(),
      url: z.string().optional(),
    })
    .optional(),
  releaseDate: z.coerce.date().optional(),
  sidebarTitle: z.string().optional(),
});

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.vercel.app/docs/mdx/collections#define-docs
export const docs = defineDocs({
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: docSchema,
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
