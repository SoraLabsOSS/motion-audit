import type { ReactNode } from "react";

import { Providers } from "./providers";

export function AuthSessionProviders({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
