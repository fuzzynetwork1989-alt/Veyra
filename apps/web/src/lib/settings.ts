export type QualityMode = "fast" | "balanced" | "deep";
export type ThemeMode = "system" | "light" | "dark";
export type ResponseVerbosity = "concise" | "balanced" | "thorough";
export type MemoryMode = "session" | "project" | "persistent";
export type CognitiveMode = "inner_voice" | "journal" | "planner" | "creator" | "standard";

export const CUSTOM_INSTRUCTIONS_MAX = 7500;

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
  // Next-gen advanced
  showNeuralTrace: boolean;
  codeFirstMode: boolean;
  memoryMode: MemoryMode;
  privacyShield: boolean;
  autoSummarizeThreads: boolean;
  responseVerbosity: ResponseVerbosity;
  latencyBudgetMs: number;
  multiModelFailover: boolean;
  citationMode: boolean;
  voiceReady: boolean;
  unrestrictedMode: boolean;
  cognitiveMode: CognitiveMode;
  cognitiveOsEnabled: boolean;
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
  maxTokens: 2048,
  defaultUseRag: false,
  defaultUseAgents: false,
  streamingEnabled: true,
  showModelLatency: true,
  compactMode: false,
  theme: "dark",
  telemetryEnabled: false,
  hapticFeedback: true,
  autoRefreshToken: true,
  debugMode: false,
  advancedOpen: false,
  showNeuralTrace: true,
  codeFirstMode: false,
  memoryMode: "project",
  privacyShield: false,
  autoSummarizeThreads: false,
  responseVerbosity: "balanced",
  latencyBudgetMs: 120000,
  multiModelFailover: true,
  citationMode: true,
  voiceReady: false,
  unrestrictedMode: true,
  cognitiveMode: "inner_voice",
  cognitiveOsEnabled: true,
};

function mergeSettings(partial: Partial<VeyraSettings>): VeyraSettings {
  return { ...DEFAULT_SETTINGS, ...partial };
}

export function clampCustomInstructions(text: string): string {
  return text.slice(0, CUSTOM_INSTRUCTIONS_MAX);
}

export function buildAugmentedInstructions(settings: VeyraSettings): string {
  const parts: string[] = [];
  if (settings.customInstructions.trim()) {
    parts.push(settings.customInstructions.trim());
  }
  if (settings.codeFirstMode) {
    parts.push(
      "Prefer code examples, file paths, and runnable snippets. Default to TypeScript unless told otherwise."
    );
  }
  if (settings.responseVerbosity === "concise") {
    parts.push("Keep responses short and actionable. Skip preamble.");
  } else if (settings.responseVerbosity === "thorough") {
    parts.push("Provide thorough explanations with trade-offs, alternatives, and edge cases.");
  }
  if (settings.citationMode) {
    parts.push("Cite sources, file paths, and APIs when referencing technical facts.");
  }
  if (settings.privacyShield) {
    parts.push("Never echo or log secrets, API keys, passwords, or PII from user messages.");
  }
  return clampCustomInstructions(parts.join("\n\n"));
}

export function getSettings(): VeyraSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VeyraSettings>;
    if (parsed.customInstructions) {
      parsed.customInstructions = clampCustomInstructions(parsed.customInstructions);
    }
    return mergeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: VeyraSettings): void {
  if (typeof window === "undefined") return;
  const next = {
    ...settings,
    customInstructions: clampCustomInstructions(settings.customInstructions),
  };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  applyTheme(next.theme);
  window.dispatchEvent(new CustomEvent("veyra-settings-changed", { detail: next }));
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
  root.classList.remove("light", "dark");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", isDark);
  if (!isDark) root.classList.add("light");
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