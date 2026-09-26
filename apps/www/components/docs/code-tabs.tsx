"use client";

import {
  ScrollArea,
  ScrollBar,
  ScrollViewport,
} from "@workspace/ui/components/ui/scroll-area";
import { cn } from "@workspace/ui/lib/utils";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { CopyButton } from "@/components/docs/copy";

const PACKAGE_MANAGER_STORAGE_KEY = "sora-ui-package-manager";
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

const isPackageManager = (value: string): value is PackageManager =>
  PACKAGE_MANAGERS.includes(value as PackageManager);

interface CodeTabsProps {
  codes: Record<string, string>;
  lang?: string;
  themes?: { light: string; dark: string };
  copyButton?: boolean;
  onCopiedChange?: (copied: boolean, content?: string) => void;
  className?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

function CodeTabs({
  codes,
  lang = "bash",
  themes = {
    dark: "github-dark",
    light: "github-light",
  },
  className,
  defaultValue,
  value,
  onValueChange,
  copyButton = true,
  onCopiedChange,
  ...props
}: CodeTabsProps) {
  const { resolvedTheme } = useTheme();

  const [highlightedCodes, setHighlightedCodes] = useState<Record<
    string,
    string
  > | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>(
    value ?? defaultValue ?? Object.keys(codes)[0] ?? ""
  );

  useEffect(() => {
    if (value !== undefined) {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(
        PACKAGE_MANAGER_STORAGE_KEY
      );
      if (storedValue && storedValue in codes) {
        setSelectedCode(storedValue);
      }
    } catch (error) {
      console.error("Error reading package manager preference", error);
    }
  }, [codes, value]);

  useEffect(() => {
    if (value !== undefined) {
      return;
    }

    const handlePackageManagerChange = (event: Event) => {
      const nextValue =
        event instanceof StorageEvent
          ? event.newValue
          : (event as CustomEvent<string>).detail;

      if (nextValue && nextValue in codes) {
        setSelectedCode(nextValue);
      }
    };

    window.addEventListener("storage", handlePackageManagerChange);
    window.addEventListener(
      "sora-ui-package-manager-change",
      handlePackageManagerChange
    );

    return () => {
      window.removeEventListener("storage", handlePackageManagerChange);
      window.removeEventListener(
        "sora-ui-package-manager-change",
        handlePackageManagerChange
      );
    };
  }, [codes, value]);

  useEffect(() => {
    async function loadHighlightedCode() {
      try {
        const { codeToHtml } = await import("shiki");
        const newHighlightedCodes: Record<string, string> = {};

        for (const [command, val] of Object.entries(codes)) {
          const highlighted = await codeToHtml(val, {
            defaultColor: resolvedTheme === "dark" ? "dark" : "light",
            lang,
            themes: {
              dark: themes.dark,
              light: themes.light,
            },
          });

          newHighlightedCodes[command] = highlighted;
        }

        setHighlightedCodes(newHighlightedCodes);
      } catch (error) {
        console.error("Error highlighting codes", error);
        setHighlightedCodes(codes);
      }
    }
    loadHighlightedCode();
  }, [resolvedTheme, lang, themes.light, themes.dark, codes]);

  const handleSelect = (code: string) => {
    setSelectedCode(code);
    if (isPackageManager(code)) {
      try {
        window.localStorage.setItem(PACKAGE_MANAGER_STORAGE_KEY, code);
        window.dispatchEvent(
          new CustomEvent("sora-ui-package-manager-change", {
            detail: code,
          })
        );
      } catch (error) {
        console.error("Error saving package manager preference", error);
      }
    }
    onValueChange?.(code);
  };

  return (
    <div
      className={cn(
        "w-full gap-0 overflow-hidden rounded-xl border border-border/60",
        className
      )}
      data-slot="install-tabs"
      {...props}
    >
      <div className="flex h-10 items-center justify-between border-border/50 border-b px-3">
        <div className="flex items-center gap-0.5">
          {Object.keys(codes).map((code) => (
            <button
              className={cn(
                "relative z-10 h-7 rounded-md px-3 font-medium text-sm transition-colors",
                selectedCode === code
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              key={code}
              onClick={() => handleSelect(code)}
              type="button"
            >
              {code}
            </button>
          ))}
        </div>

        {copyButton && highlightedCodes && (
          <CopyButton
            className="-me-1 bg-transparent hover:bg-foreground/5 dark:hover:bg-foreground/10"
            content={codes[selectedCode]}
            onCopiedChange={onCopiedChange}
            size="icon-sm"
            variant="ghost"
          />
        )}
      </div>

      <div className="p-1.5">
        <div
          className="rounded-lg bg-surface"
          data-slot="install-tabs-contents"
        >
          {highlightedCodes && (
            <div
              className="w-full"
              data-slot="install-tabs-content"
              key={selectedCode}
            >
              <ScrollArea className="max-h-[600px]">
                <ScrollViewport className="w-full">
                  <div
                    className="[&>pre,_&_code]:!bg-transparent [&_code]:!text-[13px] [&_code_.line]:!px-0 flex w-full items-center p-4 text-sm [&>pre,_&_code]:border-none [&>pre,_&_code]:[background:transparent_!important]"
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: highlighted code HTML from shiki
                    dangerouslySetInnerHTML={{
                      __html: highlightedCodes[selectedCode] ?? "",
                    }}
                  />
                </ScrollViewport>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { CodeTabs, type CodeTabsProps };
