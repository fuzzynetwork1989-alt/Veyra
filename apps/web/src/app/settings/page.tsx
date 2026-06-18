"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from "@veyra/ui";
import { AppShell } from "@/components/app-shell";
import { createApiClient } from "@/lib/api";
import { clearStoredToken, getStoredToken } from "@/lib/auth";
import {
  DEFAULT_SETTINGS,
  QualityMode,
  ThemeMode,
  VeyraSettings,
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
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-4 last:border-0 dark:border-slate-800">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [settings, setSettings] = useState<VeyraSettings>(DEFAULT_SETTINGS);
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
      const probe = createApiClient(token || undefined);
      const res = await fetch(`${settings.apiUrl.replace(/\/$/, "")}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setHealthStatus(body.status || "healthy");
      void probe;
    } catch (err) {
      setHealthStatus("unreachable");
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl">
          <header className="mb-6">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-sm text-slate-500">
              Configure Veyra for your next-gen AI workflow — desktop, mobile, and web.
            </p>
          </header>

          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connection</CardTitle>
                <CardDescription>Point Veyra at your API backend</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">API URL</label>
                  <input
                    type="url"
                    value={settings.apiUrl}
                    onChange={(e) => patch({ apiUrl: e.target.value })}
                    placeholder="http://localhost:8000"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Request timeout (ms)</label>
                  <input
                    type="number"
                    min={30000}
                    step={1000}
                    value={settings.apiTimeoutMs}
                    onChange={(e) => patch({ apiTimeoutMs: Number(e.target.value) })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={testConnection}>
                    Test connection
                  </Button>
                  {healthStatus ? (
                    <span className="text-sm text-slate-500">Status: {healthStatus}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom instructions</CardTitle>
                <CardDescription>
                  Persistent system guidance sent with every chat — your Veyra persona and rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  value={settings.customInstructions}
                  onChange={(e) => patch({ customInstructions: e.target.value })}
                  rows={6}
                  placeholder="Example: You are my senior platform engineer. Prefer TypeScript, cite file paths, and always suggest tests."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {settings.customInstructions.length} / 4000 characters
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI behavior</CardTitle>
                <CardDescription>Defaults for chat and agent runs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium">Quality mode</label>
                    <select
                      value={settings.qualityMode}
                      onChange={(e) => patch({ qualityMode: e.target.value as QualityMode })}
                      className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    >
                      <option value="fast">Fast</option>
                      <option value="balanced">Balanced</option>
                      <option value="deep">Deep</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium">
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
                    <label className="mb-1 block text-xs font-medium">Max tokens</label>
                    <input
                      type="number"
                      min={64}
                      max={4096}
                      value={settings.maxTokens}
                      onChange={(e) => patch({ maxTokens: Number(e.target.value) })}
                      className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                  </div>
                </div>
                <SettingRow label="Default RAG" description="Use project documents on new chats">
                  <Switch
                    checked={settings.defaultUseRag}
                    onCheckedChange={(v) => patch({ defaultUseRag: v })}
                    aria-label="Default RAG"
                  />
                </SettingRow>
                <SettingRow label="Default agents" description="Enable multi-agent orchestration">
                  <Switch
                    checked={settings.defaultUseAgents}
                    onCheckedChange={(v) => patch({ defaultUseAgents: v })}
                    aria-label="Default agents"
                  />
                </SettingRow>
                <SettingRow label="Streaming responses" description="Stream tokens in real time">
                  <Switch
                    checked={settings.streamingEnabled}
                    onCheckedChange={(v) => patch({ streamingEnabled: v })}
                    aria-label="Streaming"
                  />
                </SettingRow>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Experience</CardTitle>
              </CardHeader>
              <CardContent>
                <SettingRow label="Show model & latency" description="Display on assistant messages">
                  <Switch
                    checked={settings.showModelLatency}
                    onCheckedChange={(v) => patch({ showModelLatency: v })}
                    aria-label="Show model latency"
                  />
                </SettingRow>
                <SettingRow label="Compact mode" description="Tighter spacing for power users">
                  <Switch
                    checked={settings.compactMode}
                    onCheckedChange={(v) => patch({ compactMode: v })}
                    aria-label="Compact mode"
                  />
                </SettingRow>
                <SettingRow label="Haptic feedback" description="Vibration on mobile actions">
                  <Switch
                    checked={settings.hapticFeedback}
                    onCheckedChange={(v) => patch({ hapticFeedback: v })}
                    aria-label="Haptic feedback"
                  />
                </SettingRow>
                <div className="py-4">
                  <label className="mb-1 block text-sm font-medium">Theme</label>
                  <select
                    value={settings.theme}
                    onChange={(e) => patch({ theme: e.target.value as ThemeMode })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => patch({ advancedOpen: !settings.advancedOpen })}
                >
                  <div>
                    <CardTitle>Advanced settings</CardTitle>
                    <CardDescription>Privacy, tokens, and developer options</CardDescription>
                  </div>
                  <span className="text-sm text-slate-500">
                    {settings.advancedOpen ? "Hide" : "Show"}
                  </span>
                </button>
              </CardHeader>
              {settings.advancedOpen ? (
                <CardContent>
                  <SettingRow label="Anonymous telemetry" description="Help improve Veyra (opt-in)">
                    <Switch
                      checked={settings.telemetryEnabled}
                      onCheckedChange={(v) => patch({ telemetryEnabled: v })}
                      aria-label="Telemetry"
                    />
                  </SettingRow>
                  <SettingRow
                    label="Auto-refresh tokens"
                    description="Refresh access token before expiry"
                  >
                    <Switch
                      checked={settings.autoRefreshToken}
                      onCheckedChange={(v) => patch({ autoRefreshToken: v })}
                      aria-label="Auto refresh token"
                    />
                  </SettingRow>
                  <SettingRow label="Debug mode" description="Verbose client logging">
                    <Switch
                      checked={settings.debugMode}
                      onCheckedChange={(v) => patch({ debugMode: v })}
                      aria-label="Debug mode"
                    />
                  </SettingRow>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetSettings();
                        setSettings(DEFAULT_SETTINGS);
                      }}
                    >
                      Reset to defaults
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        clearStoredToken();
                        router.replace("/login");
                      }}
                    >
                      Sign out
                    </Button>
                  </div>
                </CardContent>
              ) : null}
            </Card>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex items-center gap-3">
              <Button type="submit">Save settings</Button>
              {saved ? <span className="text-sm text-green-600">Saved</span> : null}
            </div>
          </form>
        </div>
      </main>
    </AppShell>
  );
}