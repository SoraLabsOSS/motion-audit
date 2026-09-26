import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookOpen } from "lucide-react";

/**
 * Shared layout configurations
 */
export const baseOptions: BaseLayoutProps = {
  links: [
    {
      type: "separator",
      name: "Guide",
      icon: <BookOpen fill="currentColor" strokeWidth={2.5} />,
      // biome-ignore lint/suspicious/noExplicitAny: custom separator layout item
    } as any,
    {
      secondary: false,
      text: "Introduction",
      url: "/docs",
    },
    {
      secondary: false,
      text: "Installation",
      url: "/docs/installation",
    },
  ],
};
