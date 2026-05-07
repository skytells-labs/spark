"use client";

import * as React from "react";

type Theme = "dark" | "light";

const ThemeCtx = React.createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
}>({ theme: "dark", setTheme: () => {} });

/**
 * Drop-in replacement for next-themes' useTheme.
 * Reads/writes the `.dark` class on <html> and persists to localStorage.
 * No script injection — no React 19 warning.
 */
export function useTheme() {
  return React.useContext(ThemeCtx);
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Default to "dark" so SSR and first paint agree (blocking script in layout.tsx
  // ensures the correct class is already on <html> before hydration).
  const [theme, setThemeState] = React.useState<Theme>("dark");

  // After hydration, sync from what the blocking script actually applied.
  React.useEffect(() => {
    const stored = (localStorage.getItem("skytells-theme") as Theme | null) ?? "dark";
    setThemeState(stored);
    document.documentElement.classList.toggle("dark", stored === "dark");
  }, []);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("skytells-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}
