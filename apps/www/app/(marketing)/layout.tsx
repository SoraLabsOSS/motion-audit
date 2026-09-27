import type { ReactNode } from "react";

import { Navbar } from "@/components/home/navbar";

const MarketingLayout = ({ children }: { children: ReactNode }) => (
  <>
    <Navbar />
    {children}
  </>
);

export default MarketingLayout;
