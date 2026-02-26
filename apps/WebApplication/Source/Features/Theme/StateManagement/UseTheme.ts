import { useCallback, useEffect, useState } from "react";
import {
  ThemePreferenceStore,
  type ThemePreference
} from "@/Features/Theme/DataAccess/ThemePreferenceStore";

const SYSTEM_DARK_MODE_MEDIA_QUERY = "(prefers-color-scheme: dark)";
const DARK_THEME_CLASS_NAME = "dark";

const themePreferenceStore = new ThemePreferenceStore();

function readSystemThemePreference(): ThemePreference {
  return window.matchMedia(SYSTEM_DARK_MODE_MEDIA_QUERY).matches ? "dark" : "light";
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
    document.documentElement.classList.toggle(DARK_THEME_CLASS_NAME, theme === "dark");
    themePreferenceStore.writeThemePreference(theme);
  }, [theme]);

  const toggle = useCallback((): void => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
