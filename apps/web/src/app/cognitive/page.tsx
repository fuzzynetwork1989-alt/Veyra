"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@veyra/ui";
import type { CognitiveStateResponse } from "@veyra/sdk";
import { AppShell } from "@/components/app-shell";
import { BrainWave } from "@/components/brain-wave";
import { IconBrain, IconSpark } from "@/components/icons";
import { createApiClient } from "@/lib/api";
import { ensureValidToken } from "@/lib/auth-session";
import { getSettings, updateSettings, type CognitiveMode } from "@/lib/settings";

const MODE_COLORS: Record<string, string> = {
  inner_voice: "from-violet-600 to-cyan-500",
  journal: "from-rose-600 to-violet-500",
  planner: "from-cyan-600 to-blue-500",
  creator: "from-amber-500 to-rose-500",
};

export default function CognitivePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<CognitiveStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dreaming, setDreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<CognitiveMode>(getSettings().cognitiveMode);

  const client = useMemo(() => createApiClient(token || undefined), [token]);

  useEffect(() => {
    ensureValidToken().then((valid) => {
      if (!valid) {
        router.replace("/login");
        return;
      }
      setToken(valid);
    });
  }, [router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    client
      .getCognitiveState()
      .then(setState)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load cognitive state"))
      .finally(() => setLoading(false));
  }, [client, token]);

  const handleModeSelect = (mode: CognitiveMode) => {
    setActiveMode(mode);
    updateSettings({ cognitiveMode: mode, cognitiveOsEnabled: mode !== "standard" });
  };

  const handleDream = async () => {
    setDreaming(true);
    setError(null);
    try {
      await client.triggerDream();
      const refreshed = await client.getCognitiveState();
      setState(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dream cycle failed");
    } finally {
      setDreaming(false);
    }
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-y-auto">
        <header className="border-b border-white/5 bg-zinc-950/60 px-6 py-5 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-600/25">
              <IconBrain className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Veyra Cognitive OS</h1>
              <p className="text-sm text-zinc-500">
                Agentic foundation layer — polyphonic selves, temporal mind, ethics gate, dreaming
              </p>
            </div>
            <BrainWave active={dreaming} className="h-8 w-24" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-6">
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Cognitive Surfaces
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(state?.modes || []).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeSelect(mode.id as CognitiveMode)}
                  className={`group rounded-2xl border p-4 text-left transition-all ${
                    activeMode === mode.id
                      ? "border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-400/30"
                      : "border-white/5 bg-zinc-900/50 hover:border-white/10 hover:bg-zinc-900/80"
                  }`}
                >
                  <div
                    className={`mb-2 inline-flex rounded-lg bg-gradient-to-r ${
                      MODE_COLORS[mode.id] || "from-violet-600 to-cyan-500"
                    } px-2 py-0.5 text-xs font-medium text-white`}
                  >
                    {mode.label}
                  </div>
                  <p className="text-sm text-zinc-400">{mode.description}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-white/5 bg-zinc-900/60 p-4 lg:col-span-1">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Macro-time profile
              </h3>
              <p className="text-xs leading-relaxed text-zinc-500">
                {loading
                  ? "Loading…"
                  : state?.profile.macro_profile || "No macro profile yet — run a dream cycle to consolidate."}
              </p>
            </Card>

            <Card className="border-white/5 bg-zinc-900/60 p-4 lg:col-span-1">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-violet-400" />
                Meso-time themes
              </h3>
              <p className="text-xs leading-relaxed text-zinc-500">
                {loading
                  ? "Loading…"
                  : state?.meso.summary || "Recent themes will appear after dreaming consolidates sessions."}
              </p>
              {state?.meso.themes?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {state.meso.themes.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card className="border-white/5 bg-zinc-900/60 p-4 lg:col-span-1">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-200">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Veyra self-notes
              </h3>
              <p className="text-xs leading-relaxed text-zinc-500">
                {loading
                  ? "Loading…"
                  : state?.profile.self_notes || "Style adaptation notes emerge from dream consolidation."}
              </p>
            </Card>
          </div>

          <Card className="border-white/5 bg-zinc-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                  <IconSpark className="h-4 w-4 text-violet-400" />
                  Dreaming &amp; self-update
                </h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Background consolidation samples recent sessions and updates your temporal profile.
                </p>
              </div>
              <Button onClick={handleDream} disabled={dreaming || !token} className="shrink-0">
                {dreaming ? "Dreaming…" : "Run dream cycle"}
              </Button>
            </div>

            {state?.recent_dreams?.length ? (
              <div className="mt-4 space-y-2">
                {state.recent_dreams.map((dream) => (
                  <div
                    key={dream.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 px-3 py-2 text-xs"
                  >
                    <span className="text-zinc-400">
                      {dream.sessions_processed} session(s) · {dream.status}
                    </span>
                    <span className="text-zinc-600">
                      {new Date(dream.started_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-600">No dream cycles yet.</p>
            )}
          </Card>

          <div className="rounded-2xl border border-dashed border-violet-500/20 bg-violet-500/5 p-4 text-center">
            <p className="text-sm text-zinc-400">
              Active mode: <span className="font-medium text-violet-300">{activeMode.replace("_", " ")}</span>
            </p>
            <Button
              variant="outline"
              className="mt-3"
              onClick={() => router.push("/chat")}
            >
              Open chat with Cognitive OS
            </Button>
          </div>
        </main>
      </div>
    </AppShell>
  );
}