import { z } from "zod";

const ThemePreferenceSchema = z.enum(["light", "dark"]);
export const DEFAULT_THEME_PREFERENCE_STORAGE_KEY = "theme";

export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export class ThemePreferenceStore {
  private readonly storageKey: string;

  public constructor(storageKey = DEFAULT_THEME_PREFERENCE_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  public readThemePreference(): ThemePreference | null {
    const rawThemePreference = window.localStorage.getItem(this.storageKey);
    if (rawThemePreference === null) {
      return null;
    }
    const parsedThemePreference = ThemePreferenceSchema.safeParse(rawThemePreference);
    if (!parsedThemePreference.success) {
      throw new Error(
        `Theme preference at key "${this.storageKey}" is invalid. Expected "light" or "dark".`,
      );
    }
    return parsedThemePreference.data;
  }

  public writeThemePreference(themePreference: ThemePreference): void {
    const parsedThemePreference = ThemePreferenceSchema.parse(themePreference);
    window.localStorage.setItem(this.storageKey, parsedThemePreference);
  }
}
