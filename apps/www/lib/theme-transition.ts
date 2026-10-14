export type ThemeMode = "dark" | "light" | "system";

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

const THEME_TRANSITIONING_CLASS = "theme-transitioning";
const THEME_TRANSITION_TIMEOUT_MS = 350;

let themeTransitionTimer: number | null = null;

const resolveTheme = (theme: ThemeMode): "dark" | "light" => {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
};

const applyThemeToDom = (theme: ThemeMode): void => {
  const resolved = resolveTheme(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.classList.toggle("light", resolved === "light");
  document.documentElement.style.colorScheme = resolved;
};

export const setThemeWithTransition = (
  theme: ThemeMode,
  setTheme: (theme: ThemeMode) => void
): void => {
  if (typeof window === "undefined") {
    setTheme(theme);
    return;
  }

  // SAFETY: Document in supporting browsers extends the base Document interface with startViewTransition.
  const doc = document as DocumentWithViewTransition;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion || !doc.startViewTransition) {
    if (!prefersReducedMotion) {
      if (
        !document.documentElement.classList.contains(THEME_TRANSITIONING_CLASS)
      ) {
        document.documentElement.classList.add(THEME_TRANSITIONING_CLASS);
      }

      applyThemeToDom(theme);
      setTheme(theme);

      if (themeTransitionTimer !== null) {
        window.clearTimeout(themeTransitionTimer);
      }
      themeTransitionTimer = window.setTimeout(() => {
        document.documentElement.classList.remove(THEME_TRANSITIONING_CLASS);
        themeTransitionTimer = null;
      }, THEME_TRANSITION_TIMEOUT_MS);
      return;
    }

    applyThemeToDom(theme);
    setTheme(theme);
    return;
  }

  const transition = doc.startViewTransition(() => {
    applyThemeToDom(theme);
    setTheme(theme);
  });

  void (async () => {
    try {
      await transition.finished;
    } catch {
      // Ignore transitions aborted before completion
    }
  })();
};
