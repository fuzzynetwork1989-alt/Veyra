"use client";

import { useEffect, type ReactNode } from "react";
import { applyTheme, getSettings } from "@/lib/settings";

export function SettingsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(getSettings().theme);
  }, []);

  return <>{children}</>;
}