export type QualityMode = "fast" | "balanced" | "deep";
export type ThemeMode = "system" | "light" | "dark";

export interface VeyraSettings {
  apiUrl: string;
  apiTimeoutMs: number;
  customInstructions: string;
  qualityMode: QualityMode;
  temperature: number;
  maxTokens: number;
  defaultUseRag: boolean;
  defaultUseAgents: boolean;
  streamingEnabled: boolean;
  showModelLatency: boolean;
  compactMode: boolean;
  theme: ThemeMode;
  telemetryEnabled: boolean;
  hapticFeedback: boolean;
  autoRefreshToken: boolean;
  debugMode: boolean;
  advancedOpen: boolean;
}

export const SETTINGS_KEY = "veyra_settings";

export const DEFAULT_SETTINGS: VeyraSettings = {
  apiUrl:
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
    "http://localhost:8000",
  apiTimeoutMs: Number(
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_TIMEOUT_MS) || "300000"
  ),
  customInstructions: "",
  qualityMode: "balanced",
  temperature: 0.7,
  maxTokens: 1024,
  defaultUseRag: false,
  defaultUseAgents: false,
  streamingEnabled: true,
  showModelLatency: true,
  compactMode: false,
  theme: "system",
  telemetryEnabled: false,
  hapticFeedback: true,
  autoRefreshToken: true,
  debugMode: false,
  advancedOpen: false,
};

function mergeSettings(partial: Partial<VeyraSettings>): VeyraSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

export function getSettings(): VeyraSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return mergeSettings(JSON.parse(raw) as Partial<VeyraSettings>);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: VeyraSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyTheme(settings.theme);
  window.dispatchEvent(new CustomEvent("veyra-settings-changed", { detail: settings }));
}

export function updateSettings(patch: Partial<VeyraSettings>): VeyraSettings {
  const next = mergeSettings({ ...getSettings(), ...patch });
  saveSettings(next);
  return next;
}

export function resetSettings(): VeyraSettings {
  saveSettings(DEFAULT_SETTINGS);
  return DEFAULT_SETTINGS;
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

export function subscribeSettings(listener: (settings: VeyraSettings) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const custom = event as CustomEvent<VeyraSettings>;
    listener(custom.detail ?? getSettings());
  };
  window.addEventListener("veyra-settings-changed", handler);
  return () => window.removeEventListener("veyra-settings-changed", handler);
}