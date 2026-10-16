"use client";
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";

// ---------- Theme ----------
type Theme = "dark" | "light";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void; setTheme: (t: Theme) => void }>({
  theme: "dark",
  toggle: () => {},
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeCtx);
}

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem("ssa:v1:theme");
      if (t === "light" || t === "dark") setThemeState(t);
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem("ssa:v1:theme", theme);
    } catch {}
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);

  return (
    <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>
      {ready ? children : <div className="min-h-screen bg-background" />}
    </ThemeCtx.Provider>
  );
}
