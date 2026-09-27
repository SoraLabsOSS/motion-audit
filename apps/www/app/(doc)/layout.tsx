import type { ReactNode } from "react";

import { AISearchRoot } from "@/components/ai/shell";

export default function DocLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AISearchRoot />
    </>
  );
}
