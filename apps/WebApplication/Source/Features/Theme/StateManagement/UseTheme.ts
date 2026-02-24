import { useCallback, useEffect, useState } from "react";
import {
  ThemePreferenceStore,
  type ThemePreference
} from "@/Features/Theme/DataAccess/ThemePreferenceStore";

const themePreferenceStore = new ThemePreferenceStore();

function readSystemThemePreference(): ThemePreference {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitialTheme(): ThemePreference {
  const storedThemePreference = themePreferenceStore.readThemePreference();
  if (storedThemePreference) {
    return storedThemePreference;
  }
  return readSystemThemePreference();
}

export interface UseThemeResult {
  theme: ThemePreference;
  toggle: () => void;
}

export function useTheme(): UseThemeResult {
  const [theme, setTheme] = useState<ThemePreference>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    themePreferenceStore.writeThemePreference(theme);
  }, [theme]);

  const toggle = useCallback((): void => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
