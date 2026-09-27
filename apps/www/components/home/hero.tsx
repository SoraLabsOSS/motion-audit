"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { MouseEvent } from "react";

import { MotionEffect } from "@/components/effects/motion-effect";
import { usePageTransition } from "@/components/page-transition/page-transition-provider";

const WORDS = ["MOTION", "AUDIT"] as const;

export const Hero = () => {
  const { transitionTo } = usePageTransition();

  const handleDocsClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    void transitionTo("/docs", "commercial");
  };

  return (
    <div className="relative z-10 flex flex-col items-center justify-center">
      {/* 1. Eyebrow Badge */}
      <MotionEffect delay={0} fade slide={{ direction: "up", offset: 16 }}>
        <div className="bg-accent/80 border-border/40 mb-8 flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1.5 text-sm shadow-xs backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex h-6 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-medium">
              <svg
                aria-hidden="true"
                className="size-3.5"
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" x2="12" y1="9" y2="13" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </span>
            <span className="text-foreground/90 text-xs font-medium tracking-wider uppercase">
              UNDER ACTIVE DEVELOPMENT
            </span>
          </div>
        </div>
      </MotionEffect>

      {/* 2. Huge Title */}
      <MotionEffect delay={0.1} fade slide={{ direction: "up", offset: 16 }}>
        <h1 className="max-w-[320px] sm:max-w-[600px] md:max-w-[900px]">
          <span className="text-foreground block text-center text-5xl font-medium tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            {WORDS.map((word, wordIndex) => {
              const prevCharsCount = wordIndex === 0 ? 0 : WORDS[0].length + 1;

              return (
                <span key={word}>
                  {wordIndex > 0 && <span> </span>}
                  <span className="inline-block whitespace-nowrap">
                    {[...word].map((char, charIndex) => {
                      const globalIndex = prevCharsCount + charIndex;

                      return (
                        <motion.span
                          animate={{
                            filter: "blur(0px)",
                            opacity: 1,
                            y: 0,
                          }}
                          className="inline-block whitespace-pre"
                          initial={{
                            filter: "blur(10px)",
                            opacity: 0,
                            y: 10,
                          }}
                          key={`${word}-${charIndex}`}
                          transition={{
                            delay: 0.15 + globalIndex * 0.04,
                            duration: 0.55,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        >
                          {char}
                        </motion.span>
                      );
                    })}
                  </span>
                </span>
              );
            })}
          </span>
        </h1>
      </MotionEffect>

      {/* 3. Positioning / Subtitle */}
      <MotionEffect delay={0.2} fade slide={{ direction: "up", offset: 16 }}>
        <p className="mt-4 block text-center text-sm font-normal text-balance text-white sm:max-w-[540px] sm:text-base md:max-w-[720px] md:text-lg">
          Measure and understand motion performance on the web.
          <br />
          Automated animation diagnostics, compositor frame-rate analysis, and
          GPU pressure evaluation.
        </p>
      </MotionEffect>

      {/* 4. CTA Buttons */}
      <div className="mt-6 mb-8 flex flex-col gap-3 max-sm:w-full sm:flex-row sm:gap-4">
        <MotionEffect delay={0.3} fade slide={{ direction: "up", offset: 16 }}>
          <div>
            <Link
              className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive group inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-6 font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 has-[>svg]:px-6 has-[>svg]:pr-5"
              data-slot="button"
              href="/docs"
              onClick={handleDocsClick}
            >
              Documentation
              <svg
                aria-hidden="true"
                className="!size-5 transition-transform duration-200 group-hover:translate-x-1"
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </g>
              </svg>
            </Link>
          </div>
        </MotionEffect>

        <MotionEffect delay={0.35} fade slide={{ direction: "up", offset: 16 }}>
          <div>
            <a
              className="bg-accent text-accent-foreground hover:bg-accent/90 border-border/40 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive group inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-6 font-medium whitespace-nowrap shadow-xs transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
              data-slot="button"
              href="https://github.com/SoraLabsOSS/motion-audit"
              rel="noopener noreferrer"
              target="_blank"
            >
              <svg
                aria-hidden="true"
                className="size-4"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              GitHub
            </a>
          </div>
        </MotionEffect>
      </div>
    </div>
  );
};
