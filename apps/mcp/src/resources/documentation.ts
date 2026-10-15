import type { ResourceMetadata } from "xmcp";

import { motionDocsSource } from "../docs/motion-docs-source";

export const metadata: ResourceMetadata = {
  description:
    "Complete table of contents and documentation index for Motion Audit (https://motion.soralabs.studio)",
  mimeType: "text/plain",
  name: "motion-audit-docs",
  title: "Motion Audit Documentation Index",
};

export default async function documentationResource() {
  return await motionDocsSource.getIndex();
}
