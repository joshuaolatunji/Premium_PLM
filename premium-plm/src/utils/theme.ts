import { useState } from "react";

// Light / dark mode. The chosen theme is written to <html data-theme="…">,
// which the CSS keys off. index.html applies the saved (or system) theme
// before React loads, so the page never flashes the wrong colours.
export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "plm-theme";

function systemTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// The theme currently on <html>, falling back to a saved choice, then to the
// operating system's setting.
export function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme;

  if (applied === "light" || applied === "dark") {
    return applied;
  }

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);

    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Storage unavailable (private mode etc.) — use the system setting.
  }

  return systemTheme();
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Not saved — the choice still applies for this visit.
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";

    applyTheme(next);
    setTheme(next);
  }

  return { theme, toggleTheme };
}
