"use client";

import { FileTree } from "@workspace/ui/components/file-tree";
import type { FileTreeElement } from "@workspace/ui/components/file-tree";
import { cn } from "@workspace/ui/lib/utils";

const INSTALLATION_PROJECT_TREE: FileTreeElement[] = [
  {
    children: [
      {
        children: [
          {
            id: "your-project/app/page.tsx",
            name: "page.tsx",
            type: "file",
          },
        ],
        defaultOpen: true,
        id: "your-project/app",
        name: "app",
        type: "folder",
      },
      {
        children: [
          {
            children: [
              {
                children: [
                  {
                    highlight: true,
                    id: "your-project/components/sora-ui/texts/text-effect.tsx",
                    name: "text-effect.tsx",
                    type: "file",
                  },
                ],
                defaultOpen: true,
                id: "your-project/components/sora-ui/texts",
                name: "texts",
                type: "folder",
              },
            ],
            defaultOpen: true,
            id: "your-project/components/sora-ui",
            name: "sora-ui",
            type: "folder",
          },
        ],
        defaultOpen: true,
        id: "your-project/components",
        name: "components",
        type: "folder",
      },
      {
        children: [
          {
            highlight: true,
            id: "your-project/lib/utils.ts",
            name: "utils.ts",
            type: "file",
          },
        ],
        defaultOpen: true,
        id: "your-project/lib",
        name: "lib",
        type: "folder",
      },
      {
        highlight: true,
        id: "your-project/components.json",
        name: "components.json",
        type: "file",
      },
    ],
    defaultOpen: true,
    id: "your-project",
    name: "your-project",
    type: "folder",
  },
];

interface InstallationFileStructureProps {
  className?: string;
}

export function InstallationFileStructure({
  className,
}: InstallationFileStructureProps) {
  return (
    <section className={cn("not-prose my-8 flex flex-col gap-3", className)}>
      <h2 className="text-2xl font-semibold tracking-tight">
        Project structure
      </h2>
      <p className="text-fd-muted-foreground text-sm leading-relaxed">
        After <code className="text-fd-foreground">shadcn init</code>,
        registering <code className="text-fd-foreground">@soralabs</code>, and
        adding a primitive, your app typically looks like this. Highlighted
        files are created or updated by the CLI.
      </p>
      <FileTree
        className="bg-muted/30"
        defaultOpenIds={["your-project"]}
        elements={INSTALLATION_PROJECT_TREE}
        highlightColor="var(--code-highlight)"
      />
    </section>
  );
}
