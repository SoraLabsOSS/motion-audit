import path from "node:path";
import { fileURLToPath } from "node:url";

import { printErrors, scanURLs, validateFiles } from "next-validate-link";

import {
  augmentScannedUrls,
  buildPopulate,
  getAllContentFiles,
} from "@/lib/docs/link-validation";

const appRoot = path.resolve(import.meta.dirname, "..");

async function checkLinks(): Promise<void> {
  const scanned = await scanURLs({
    cwd: appRoot,
    populate: buildPopulate(),
    preset: "next",
  });
  augmentScannedUrls(scanned);

  printErrors(
    await validateFiles(await getAllContentFiles(), {
      checkRelativePaths: "as-url",
      markdown: {
        components: {
          Card: { attributes: ["href"] },
        },
      },
      scanned,
    }),
    true
  );
}

await checkLinks();
