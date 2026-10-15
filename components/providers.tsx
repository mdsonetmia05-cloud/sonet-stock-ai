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

// ---------- Auth (demo, local only) ----------
export interface DemoUser {
  id: string;
  name: string;
  email: string;
}

const AuthCtx = createContext<{
  user: DemoUser | null;
  signIn: (name: string, email: string) => void;
  signOut: () => void;
}>({ user: null, signIn: () => {}, signOut: () => {} });

export function useAuth() {
  return useContext(AuthCtx);
}

const AUTH_KEY = "ssa:v1:auth";

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const t = window.localStorage.getItem("ssa:v1:theme");
      if (t === "light" || t === "dark") setThemeState(t);
      const a = window.localStorage.getItem(AUTH_KEY);
      if (a) setUser(JSON.parse(a));
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

  const signIn = useCallback((name: string, email: string) => {
    const u: DemoUser = {
      id: `demo-${email.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "user"}`,
      name: name.trim() || "Demo Creator",
      email: email.trim(),
    };
    setUser(u);
    try {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    } catch {}
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      window.localStorage.removeItem(AUTH_KEY);
    } catch {}
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, toggle, setTheme }}>
      <AuthCtx.Provider value={{ user, signIn, signOut }}>
        {ready ? children : <div className="min-h-screen bg-background" />}
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}
