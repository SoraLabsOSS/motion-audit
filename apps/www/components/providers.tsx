"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

import { CommandPaletteGroupsProvider } from "@/components/command-palette/command-palette-groups-provider";
import { PageTransitionProvider } from "@/components/page-transition/page-transition-provider";
import type { CommandPaletteGroup } from "@/lib/command-palette/types";
import { getQueryClient } from "@/lib/query-client";

interface ProvidersProps {
  children: ReactNode;
  commandGroups: CommandPaletteGroup[];
}

export const Providers = ({ children, commandGroups }: ProvidersProps) => {
  const queryClient = getQueryClient();

  return (
    <CommandPaletteGroupsProvider groups={commandGroups}>
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <PageTransitionProvider>{children}</PageTransitionProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </CommandPaletteGroupsProvider>
  );
};
