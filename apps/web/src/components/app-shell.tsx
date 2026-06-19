"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@veyra/ui";
import { IconChat, IconHome, IconSettings, IconSpark, IconTasks } from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

function NavIcon({ href, label, icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200",
        active
          ? "bg-gradient-to-br from-violet-600 to-violet-500 text-white shadow-lg shadow-violet-600/30 ring-1 ring-violet-400/30"
          : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
      )}
    >
      {icon}
      <span className="pointer-events-none absolute left-full z-50 ml-3 hidden whitespace-nowrap rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 shadow-xl md:group-hover:block">
        {label}
      </span>
    </Link>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: <IconHome /> },
  { href: "/chat", label: "Chat", icon: <IconChat /> },
  { href: "/tasks", label: "Tasks", icon: <IconTasks /> },
  { href: "/settings", label: "Settings", icon: <IconSettings /> },
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
    <div className="veyra-mesh flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {showNav ? (
        <nav className="z-20 flex w-[4.5rem] shrink-0 flex-col items-center gap-2 border-r border-white/5 bg-zinc-950/80 px-2 py-5 backdrop-blur-xl">
          <Link
            href="/"
            className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-600/25 transition-transform hover:scale-105"
            title="Veyra"
          >
            <IconSpark className="h-5 w-5 text-white" />
          </Link>
          <div className="flex flex-1 flex-col gap-1.5">
            {NAV_ITEMS.map((item) => (
              <NavIcon
                key={item.href}
                {...item}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              />
            ))}
          </div>
        </nav>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </div>
  );
}