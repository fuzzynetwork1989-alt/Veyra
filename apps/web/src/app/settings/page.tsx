"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Switch } from "@veyra/ui";
import { UserUsageSummary } from "@veyra/sdk";
import { AppShell } from "@/components/app-shell";
import { IconBrain, IconSpark } from "@/components/icons";
import { createApiClient } from "@/lib/api";
import { logoutSession } from "@/lib/auth-session";
import { getStoredToken } from "@/lib/auth";
import {
  CUSTOM_INSTRUCTIONS_MAX,
  CognitiveMode,
  DEFAULT_SETTINGS,
  MemoryMode,
  QualityMode,
  ResponseVerbosity,
  ThemeMode,
  VeyraSettings,
  clampCustomInstructions,
  getSettings,
  resetSettings,
  saveSettings,
} from "@/lib/settings";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="veyra-glass rounded-2xl p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {description ? <p className="mt-1 text-xs text-zinc-500">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<VeyraSettings>(DEFAULT_SETTINGS);
  const [usage, setUsage] = useState<UserUsageSummary | null>(null);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setToken(stored);
    setSettings(getSettings());
    createApiClient(stored)
      .getUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [router]);

  function patch(partial: Partial<VeyraSettings>) {
    setSettings((prev) => ({ ...prev, ...partial }));
    setSaved(false);
  }

  function handleSave(event: FormEvent) {
    event.preventDefault();
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function testConnection() {
    setError(null);
    setHealthStatus("checking...");
    try {
      saveSettings(settings);
      const res = await fetch(`${settings.apiUrl.replace(/\/$/, "")}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setHealthStatus(body.status || "healthy");
    } catch (err) {
      setHealthStatus("unreachable");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }

  const charCount = settings.customInstructions.length;
  const charPct = Math.round((charCount / CUSTOM_INSTRUCTIONS_MAX) * 100);

  return (
    <AppShell>
      <main className="h-full overflow-y-auto px-4 py-6 md:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <header className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-cyan-500">
              <IconSpark className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
              <p className="text-sm text-zinc-500">
                Configure Veyra&apos;s neural engine, persona, and next-gen capabilities
              </p>
            </div>
          </header>

          <form onSubmit={handleSave} className="space-y-5">
            <Section title="Connection" description="API backend for chat, tasks, and memory">
              <div className="space-y-3">
                <input
                  type="url"
                  value={settings.apiUrl}
                  onChange={(e) => patch({ apiUrl: e.target.value })}
                  placeholder="http://localhost:8000"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-500">Timeout (ms)</label>
                    <input
                      type="number"
                      min={30000}
                      step={1000}
                      value={settings.apiTimeoutMs}
                      onChange={(e) => patch({ apiTimeoutMs: Number(e.target.value) })}
                      className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="outline" className="w-full border-white/10" onClick={testConnection}>
                      Test connection
                    </Button>
                  </div>
                </div>
                {healthStatus ? (
                  <p className="text-xs text-zinc-500">API status: {healthStatus}</p>
                ) : null}
              </div>
            </Section>

            <Section
              title="Custom instructions for the LLM"
              description="Persistent system persona — sent with every chat (up to 7,500 characters)"
            >
              <div className="mb-3 flex items-center gap-2 text-violet-300">
                <IconBrain className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Veyra persona</span>
              </div>
              <textarea
                value={settings.customInstructions}
                onChange={(e) =>
                  patch({ customInstructions: clampCustomInstructions(e.target.value) })
                }
                rows={12}
                placeholder="Example: You are my senior staff engineer. Always propose tests, cite file paths, prefer TypeScript, and explain trade-offs before recommending a solution."
                className="w-full rounded-xl border border-violet-500/20 bg-zinc-950/80 px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none focus:ring-2 focus:ring-violet-500/40"
              />
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={charCount > CUSTOM_INSTRUCTIONS_MAX * 0.9 ? "text-amber-400" : "text-zinc-500"}>
                  {charCount.toLocaleString()} / {CUSTOM_INSTRUCTIONS_MAX.toLocaleString()} characters
                </span>
                <div className="h-1.5 w-32 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 transition-all"
                    style={{ width: `${Math.min(charPct, 100)}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-600">
                Code-first mode, verbosity, and privacy shield append additional guidance automatically.
              </p>
            </Section>

            <Section title="AI behavior" description="Defaults for every new conversation">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Quality mode</label>
                  <select
                    value={settings.qualityMode}
                    onChange={(e) => patch({ qualityMode: e.target.value as QualityMode })}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-2 py-2 text-sm text-zinc-100"
                  >
                    <option value="fast">Fast</option>
                    <option value="balanced">Balanced</option>
                    <option value="deep">Deep reasoning</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">
                    Temperature ({settings.temperature})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(e) => patch({ temperature: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">Max tokens</label>
                  <input
                    type="number"
                    min={256}
                    max={8192}
                    value={settings.maxTokens}
                    onChange={(e) => patch({ maxTokens: Number(e.target.value) })}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-2 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>
              <SettingRow label="Default RAG" description="Use project documents automatically">
                <Switch checked={settings.defaultUseRag} onCheckedChange={(v) => patch({ defaultUseRag: v })} aria-label="Default RAG" />
              </SettingRow>
              <SettingRow label="Multi-agent mode" description="Planner + builder + reviewer orchestration">
                <Switch checked={settings.defaultUseAgents} onCheckedChange={(v) => patch({ defaultUseAgents: v })} aria-label="Agents" />
              </SettingRow>
              <SettingRow label="Cognitive OS" description="Polyphonic inner selves, temporal mind, ethics gate">
                <Switch
                  checked={settings.cognitiveOsEnabled}
                  onCheckedChange={(v) => patch({ cognitiveOsEnabled: v, cognitiveMode: v ? settings.cognitiveMode : "standard" })}
                  aria-label="Cognitive OS"
                />
              </SettingRow>
              {settings.cognitiveOsEnabled ? (
                <div className="py-4">
                  <label className="mb-1 block text-xs text-zinc-500">Cognitive surface mode</label>
                  <select
                    value={settings.cognitiveMode}
                    onChange={(e) => patch({ cognitiveMode: e.target.value as CognitiveMode })}
                    className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100"
                  >
                    <option value="inner_voice">Inner Voice — full chorus</option>
                    <option value="journal">Journal — reflection &amp; macro-time</option>
                    <option value="planner">Planner — strategist + challenger</option>
                    <option value="creator">Creator Lab — reframes &amp; synthesis</option>
                  </select>
                </div>
              ) : null}
              <SettingRow label="Streaming responses" description="Token-by-token like ChatGPT">
                <Switch checked={settings.streamingEnabled} onCheckedChange={(v) => patch({ streamingEnabled: v })} aria-label="Streaming" />
              </SettingRow>
            </Section>

            <Section title="Experience">
              <SettingRow label="Show model & latency" description="Display on assistant messages">
                <Switch checked={settings.showModelLatency} onCheckedChange={(v) => patch({ showModelLatency: v })} aria-label="Model latency" />
              </SettingRow>
              <SettingRow label="Compact mode" description="Tighter chat spacing">
                <Switch checked={settings.compactMode} onCheckedChange={(v) => patch({ compactMode: v })} aria-label="Compact" />
              </SettingRow>
              <SettingRow label="Haptic feedback" description="Mobile vibration on actions">
                <Switch checked={settings.hapticFeedback} onCheckedChange={(v) => patch({ hapticFeedback: v })} aria-label="Haptics" />
              </SettingRow>
              <div className="py-4">
                <label className="mb-1 block text-xs text-zinc-500">Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) => patch({ theme: e.target.value as ThemeMode })}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </Section>

            {usage ? (
              <Section title="Usage today" description="Quotas unlocked for local development">
                <div className="grid grid-cols-3 gap-3 text-center text-xs">
                  <div className="rounded-xl bg-zinc-900/60 p-3">
                    <p className="text-lg font-semibold text-zinc-100">{usage.daily.chats}</p>
                    <p className="text-zinc-500">Chats</p>
                  </div>
                  <div className="rounded-xl bg-zinc-900/60 p-3">
                    <p className="text-lg font-semibold text-zinc-100">{usage.daily.tokens.toLocaleString()}</p>
                    <p className="text-zinc-500">Tokens</p>
                  </div>
                  <div className="rounded-xl bg-zinc-900/60 p-3">
                    <p className="text-lg font-semibold text-zinc-100">{usage.daily.tasks}</p>
                    <p className="text-zinc-500">Tasks</p>
                  </div>
                </div>
              </Section>
            ) : null}

            <section className="veyra-glass rounded-2xl p-5">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => patch({ advancedOpen: !settings.advancedOpen })}
              >
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">Next-gen advanced settings</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Neural trace, memory modes, privacy shield — capabilities beyond typical LLM apps
                  </p>
                </div>
                <span className="text-sm text-violet-400">{settings.advancedOpen ? "Hide" : "Show"}</span>
              </button>

              {settings.advancedOpen ? (
                <div className="mt-4 border-t border-white/5 pt-2">
                  <SettingRow label="Neural trace panel" description="Show live brain-wave reasoning while processing">
                    <Switch checked={settings.showNeuralTrace} onCheckedChange={(v) => patch({ showNeuralTrace: v })} aria-label="Neural trace" />
                  </SettingRow>
                  <SettingRow label="Code-first mode" description="Bias toward runnable code and file paths">
                    <Switch checked={settings.codeFirstMode} onCheckedChange={(v) => patch({ codeFirstMode: v })} aria-label="Code first" />
                  </SettingRow>
                  <SettingRow label="Citation mode" description="Require sources and path references">
                    <Switch checked={settings.citationMode} onCheckedChange={(v) => patch({ citationMode: v })} aria-label="Citations" />
                  </SettingRow>
                  <SettingRow label="Privacy shield" description="Strip secrets and PII from model guidance">
                    <Switch checked={settings.privacyShield} onCheckedChange={(v) => patch({ privacyShield: v })} aria-label="Privacy" />
                  </SettingRow>
                  <SettingRow label="Multi-model failover" description="Graceful fallback when LLM is unreachable">
                    <Switch checked={settings.multiModelFailover} onCheckedChange={(v) => patch({ multiModelFailover: v })} aria-label="Failover" />
                  </SettingRow>
                  <SettingRow label="Auto-summarize threads" description="Compress long sessions before context window fills">
                    <Switch checked={settings.autoSummarizeThreads} onCheckedChange={(v) => patch({ autoSummarizeThreads: v })} aria-label="Summarize" />
                  </SettingRow>
                  <SettingRow label="Unrestricted mode" description="Disable client-side limits (server quotas also unlocked)">
                    <Switch checked={settings.unrestrictedMode} onCheckedChange={(v) => patch({ unrestrictedMode: v })} aria-label="Unrestricted" />
                  </SettingRow>
                  <SettingRow label="Auto-refresh tokens" description="Keep you signed in without re-login">
                    <Switch checked={settings.autoRefreshToken} onCheckedChange={(v) => patch({ autoRefreshToken: v })} aria-label="Auto refresh" />
                  </SettingRow>
                  <SettingRow label="Debug mode" description="Verbose client logging">
                    <Switch checked={settings.debugMode} onCheckedChange={(v) => patch({ debugMode: v })} aria-label="Debug" />
                  </SettingRow>
                  <SettingRow label="Telemetry" description="Anonymous usage analytics (opt-in)">
                    <Switch checked={settings.telemetryEnabled} onCheckedChange={(v) => patch({ telemetryEnabled: v })} aria-label="Telemetry" />
                  </SettingRow>
                  <div className="grid gap-3 py-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Memory mode</label>
                      <select
                        value={settings.memoryMode}
                        onChange={(e) => patch({ memoryMode: e.target.value as MemoryMode })}
                        className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-2 py-2 text-sm text-zinc-100"
                      >
                        <option value="session">Session only</option>
                        <option value="project">Project-scoped</option>
                        <option value="persistent">Persistent across projects</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-500">Response verbosity</label>
                      <select
                        value={settings.responseVerbosity}
                        onChange={(e) => patch({ responseVerbosity: e.target.value as ResponseVerbosity })}
                        className="w-full rounded-xl border border-white/10 bg-zinc-900/80 px-2 py-2 text-sm text-zinc-100"
                      >
                        <option value="concise">Concise</option>
                        <option value="balanced">Balanced</option>
                        <option value="thorough">Thorough</option>
                      </select>
                    </div>
                  </div>
                  <div className="py-2">
                    <label className="mb-1 block text-xs text-zinc-500">
                      Latency budget ({settings.latencyBudgetMs / 1000}s)
                    </label>
                    <input
                      type="range"
                      min={30000}
                      max={600000}
                      step={10000}
                      value={settings.latencyBudgetMs}
                      onChange={(e) => patch({ latencyBudgetMs: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="border-white/10" onClick={() => { resetSettings(); setSettings(DEFAULT_SETTINGS); }}>
                      Reset defaults
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10"
                      onClick={async () => {
                        await logoutSession();
                        router.replace("/login");
                      }}
                    >
                      Sign out everywhere
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <div className="flex items-center gap-3 pb-8">
              <Button type="submit" className="bg-violet-600 hover:bg-violet-500">
                Save settings
              </Button>
              {saved ? <span className="text-sm text-emerald-400">Saved</span> : null}
              <Link href="/chat" className="text-sm text-zinc-500 hover:text-zinc-300">
                Back to chat →
              </Link>
            </div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}