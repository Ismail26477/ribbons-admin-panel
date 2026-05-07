import { useEffect } from "react";

const KEY = "ribbons.theme";

/** Theme switching is disabled — site is always light. */
export const useTheme = () => {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);
  return { theme: "light" as const, setTheme: () => {}, toggle: () => {} };
};
