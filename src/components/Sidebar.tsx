"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Board", icon: "📋" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/bookings", label: "Bookings", icon: "🗓️" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50 safe-bottom">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={"flex-1 flex flex-col items-center py-2 text-[10px] transition-colors " +
                (active ? "text-blue-400" : "text-gray-500")}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setCollapsed(false)}
        onMouseLeave={() => setCollapsed(true)}
        className={"hidden sm:flex flex-col shrink-0 bg-gray-900/80 border-r border-gray-800/60 transition-all duration-200 " +
          (collapsed ? "w-14" : "w-48")}
      >
        <div className={"px-3 py-4 border-b border-gray-800/40 " + (collapsed ? "text-center" : "")}>
          <span className="text-lg font-bold">
            {collapsed ? "L" : "Launchdesk"}
          </span>
        </div>
        <nav className="flex-1 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={"flex items-center gap-3 px-3 py-2.5 mx-1 rounded-lg text-sm transition-colors " +
                  (active
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200")}
              >
                <span className="text-base shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-gray-800/40">
          <Link
            href="/bookings"
            className={"flex items-center gap-3 text-xs transition-colors " +
              (collapsed ? "justify-center" : "") +
              " text-gray-500 hover:text-gray-300"}
          >
            <span>⚙️</span>
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
