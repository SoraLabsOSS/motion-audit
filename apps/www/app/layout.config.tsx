import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

/**
 * Shared layout configurations
 */
export const baseOptions: BaseLayoutProps = {
  links: [
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
