import AnimateUIIcon from "@workspace/ui/components/icons/animateui-icon";
import { loader } from "fumadocs-core/source";
import type { InferMetaType, InferPageType } from "fumadocs-core/source";
import { icons } from "lucide-react";
import { createElement } from "react";

import { docs } from "@/.source";
import { LucideIcons } from "@/components/icons/lucide-icons";
import { attachFile } from "@/lib/docs/attach-file";
import { attachSeparator } from "@/lib/docs/attach-separator";

export const source = loader({
  baseUrl: "/docs",
  icon(icon) {
    if (!icon) {
      return;
    }
    if (icon in icons) {
      return createElement(icons[icon as keyof typeof icons]);
    }
    if (icon === "AnimateUIIcon") {
      return createElement(AnimateUIIcon);
    }
    if (icon === "LucideIcons") {
      return createElement(LucideIcons);
    }
  },
  pageTree: {
    attachFile,
    attachSeparator,
  },
  source: docs.toFumadocsSource(),
});

export type Page = InferPageType<typeof source>;
export type Meta = InferMetaType<typeof source>;
