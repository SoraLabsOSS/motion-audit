"use client";

import { Switch } from "@workspace/ui/components/ui/switch";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useSyncExternalStore } from "react";

import { setThemeWithTransition } from "@/lib/theme/set-theme-with-transition";

const noop = () => null;
const emptySubscribe = () => noop;

export const ThemeSwitcher = ({ className }: { className?: string }) => {
  const { resolvedTheme: theme, setTheme } = useTheme();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const handleThemeChange = useCallback(
    (checked: boolean) => {
      setThemeWithTransition(setTheme, checked ? "dark" : "light");
    },
    [setTheme]
  );

  if (!isClient) {
    return null;
  }

  return (
    <Switch
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      checked={theme === "dark"}
      checkedIcon={<Moon className="size-3 text-primary-foreground" />}
      className={className}
      onCheckedChange={handleThemeChange}
      uncheckedIcon={<Sun className="size-3 text-muted-foreground" />}
    />
  );
};
