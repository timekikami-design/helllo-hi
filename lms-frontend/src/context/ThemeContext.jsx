// lms-frontend/src/context/ThemeContext.jsx
// Light / Dark / System theme (default: System). The class is applied
// before first paint by the inline script in index.html; this provider
// keeps it in sync, persists the choice (localStorage "aust_theme",
// guarded) and follows OS changes while "system" is selected.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KEY = "aust_theme";
const ThemeContext = createContext({ theme: "light", preference: "system", setTheme: () => {}, toggleTheme: () => {} });

const readPref = () => {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch (_) { return "system"; }
};
const systemDark = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState(readPref);
  const [osDark, setOsDark] = useState(systemDark);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = (e) => setOsDark(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  const theme = preference === "system" ? (osDark ? "dark" : "light") : preference;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    try { window.localStorage.setItem(KEY, preference); } catch (_) { /* storage unavailable */ }
  }, [theme, preference]);

  // setTheme accepts "light" | "dark" | "system" (existing callers pass light/dark).
  const setTheme = useCallback((t) => setPreference(t === "dark" || t === "light" ? t : "system"), []);
  const toggleTheme = useCallback(() => setPreference((p) => {
    const cur = p === "system" ? (systemDark() ? "dark" : "light") : p;
    return cur === "dark" ? "light" : "dark";
  }), []);

  const value = useMemo(() => ({ theme, preference, setTheme, toggleTheme }), [theme, preference, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
