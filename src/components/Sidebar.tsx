"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  DEFAULT_THEME,
  normalizeTheme,
  THEME_CLASS,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

const NAV_ITEMS = [
  { href: "/", label: "Board", icon: "📋" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/bookings", label: "Bookings", icon: "🗓️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") {
      return DEFAULT_THEME;
    }

    try {
      return normalizeTheme(localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return document.documentElement.classList.contains(THEME_CLASS)
        ? "light"
        : DEFAULT_THEME;
    }
  });

  const applyTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    document.documentElement.classList.toggle(THEME_CLASS, nextTheme === "light");
    document.documentElement.style.colorScheme = nextTheme;
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const toggleTheme = () => {
    applyTheme(theme === "dark" ? "light" : "dark");
  };

  const themeLabel = theme === "dark" ? "Light mode" : "Dark mode";
  const themeIcon = theme === "dark" ? "☀" : "☾";
  const themeTitle = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface-strong border-t border-theme flex z-50 safe-bottom">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex-1 flex flex-col items-center py-2 text-[10px] transition-colors " +
                (active ? "text-accent" : "text-muted")
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex-1 flex flex-col items-center py-2 text-[10px] text-muted transition-colors"
          aria-pressed={theme === "light"}
          title={themeTitle}
        >
          <span className="text-lg">{themeIcon}</span>
          <span>{themeLabel}</span>
        </button>
      </nav>

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={
          "hidden sm:flex flex-col shrink-0 bg-surface border-r border-theme transition-all duration-200 " +
          (collapsed ? "w-14" : "w-48")
        }
      >
        <div className={"px-3 py-4 border-b border-theme-soft " + (collapsed ? "text-center" : "")}>
          <span className="text-lg font-bold">{collapsed ? "A" : "AISecretary"}</span>
        </div>
        <nav className="flex-1 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-sm transition-colors " +
                  (active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-muted hover:text-app")
                }
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-theme-soft space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            className={
              "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors " +
              (collapsed ? "justify-center" : "") +
              " bg-surface-muted text-app hover:bg-surface-soft"
            }
            aria-pressed={theme === "light"}
            title={themeTitle}
          >
            <span>{themeIcon}</span>
            {!collapsed && <span>{themeLabel}</span>}
          </button>
          <Link
            href="/bookings"
            className={
              "flex items-center gap-3 text-xs transition-colors " +
              (collapsed ? "justify-center" : "") +
              " text-muted hover:text-app"
            }
          >
            <span>⚙️</span>
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
