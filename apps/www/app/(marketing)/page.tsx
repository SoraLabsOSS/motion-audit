"use client";

import Link from "next/link";

import { GradientCanvas } from "@/components/home/gradient-canvas";
import { usePageTransition } from "@/components/page-transition/page-transition-provider";

const HomePage = () => {
  const { transitionTo } = usePageTransition();

  return (
    <main className="bg-background relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-6 text-center">
      <GradientCanvas />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <Link
          className="bg-foreground text-background rounded-lg px-6 py-3 font-medium shadow-lg transition-opacity hover:opacity-90"
          href="/docs"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
              return;
            }
            e.preventDefault();
            transitionTo("/docs", "commercial");
          }}
        >
          Documentation
        </Link>
      </div>
    </main>
  );
};

export default HomePage;
