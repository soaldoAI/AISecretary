export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "aisecretary-theme";
export const THEME_CLASS = "light";
export const DEFAULT_THEME: Theme = "dark";

export function normalizeTheme(value: string | null | undefined): Theme {
  return value === "light" ? "light" : "dark";
}

