"use client";

import { HydrationBoundary, QueryClientProvider } from "@tanstack/react-query";
import type { DehydratedState } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getQueryClient } from "@/lib/query-client";

export function Providers({
  children,
  dehydratedState,
}: {
  children: ReactNode;
  dehydratedState?: DehydratedState;
}) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
}
