"use client";

import { useEffect, type ReactNode } from "react";
import { applyTheme, getSettings, subscribeSettings } from "@/lib/settings";

export function SettingsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(getSettings().theme);
    return subscribeSettings((settings) => applyTheme(settings.theme));
  }, []);

  return <>{children}</>;
}