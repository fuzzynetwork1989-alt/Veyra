"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@veyra/ui";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

function NavIcon({
  href,
  label,
  icon,
  active,
}: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all",
        "hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95",
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
          : "text-slate-600 dark:text-slate-300"
      )}
    >
      <span className="h-5 w-5">{icon}</span>
      <span className="mt-0.5 text-[9px] font-medium">{label}</span>
    </Link>
  );
}

const ChatIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
  </svg>
);

const TasksIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const SettingsIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const HomeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/chat", label: "Chat", icon: ChatIcon },
  { href: "/tasks", label: "Tasks", icon: TasksIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({
  children,
  showNav = true,
}: {
  children: ReactNode;
  showNav?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {showNav ? (
        <nav className="order-2 flex shrink-0 items-center justify-around gap-1 border-t border-slate-200 bg-white/90 px-2 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90 md:order-1 md:w-20 md:flex-col md:justify-start md:border-r md:border-t-0 md:py-6">
          <div className="mb-0 hidden text-center md:mb-6 md:block">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-lg font-bold text-transparent">
              V
            </span>
          </div>
          {NAV_ITEMS.map((item) => (
            <NavIcon
              key={item.href}
              {...item}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
            />
          ))}
        </nav>
      ) : null}
      <div className="order-1 min-h-0 flex-1 md:order-2">{children}</div>
    </div>
  );
}