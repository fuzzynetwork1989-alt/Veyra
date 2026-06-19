"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@veyra/ui";
import { ChatHistoryMessage, ChatSessionSummary, ProjectSummary } from "@veyra/sdk";
import { AppShell } from "@/components/app-shell";
import { BrainWave } from "@/components/brain-wave";
import { IconBrain, IconPlus, IconSend, IconSpark, IconUser } from "@/components/icons";
import { ThinkingPanel, type ThinkingStep } from "@/components/thinking-panel";
import { createApiClient } from "@/lib/api";
import {
  clearStoredSessionId,
  clearStoredToken,
  getStoredSessionId,
  getStoredToken,
  setStoredSessionId,
} from "@/lib/auth";
import { getStoredProjectId, setStoredProjectId } from "@/lib/project";
import { getSettings } from "@/lib/settings";

const SUGGESTIONS = [
  "Plan a microservice architecture for my app",
  "Review this API design for security issues",
  "Break down a feature into implementation tasks",
];

export default function ChatPage() {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [input, setInput] = useState("");
  const [useRag, setUseRag] = useState(() => getSettings().defaultUseRag);
  const [showMeta, setShowMeta] = useState(() => getSettings().showModelLatency);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const client = useMemo(() => createApiClient(token || undefined), [token]);

  useEffect(() => {
    const storedToken = getStoredToken();
    if (!storedToken) {
      router.replace("/login");
      return;
    }
    setToken(storedToken);
    setSessionId(getStoredSessionId());
    setProjectId(getStoredProjectId());
  }, [router]);

  useEffect(() => {
    if (!token) return;
    client
      .listProjects()
      .then(async (items) => {
        if (items.length === 0) {
          const created = await client.createProject("Default Project", "Auto-created workspace");
          items = [created];
        }
        setProjects(items);
        const stored = getStoredProjectId();
        const active = stored && items.some((p) => p.id === stored) ? stored : items[0]?.id;
        if (active) {
          setProjectId(active);
          setStoredProjectId(active);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, [client, token]);

  useEffect(() => {
    if (!token) return;
    client
      .listChatSessions(projectId || undefined)
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [client, token, projectId, sessionId, messages.length]);

  useEffect(() => {
    if (!token || !sessionId) {
      setMessages([]);
      return;
    }
    client
      .getChatHistory(sessionId)
      .then((history) => setMessages(history.messages))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load chat history"));
  }, [client, token, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingSteps, loading]);

  async function handleSubmit(event?: FormEvent, preset?: string) {
    event?.preventDefault();
    const outgoing = (preset ?? input).trim();
    if (!outgoing || !token || loading) return;

    setLoading(true);
    setStreaming(true);
    setError(null);
    setThinkingSteps([]);
    setInput("");

    const userMessage: ChatHistoryMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: outgoing,
      created_at: new Date().toISOString(),
    };
    const assistantId = `local-assistant-${Date.now()}`;
    const assistantMessage: ChatHistoryMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      model: "processing",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const prefs = getSettings();
      const requestOptions = {
        sessionId: sessionId || undefined,
        projectId: projectId || undefined,
        useRag,
        useAgents: prefs.defaultUseAgents,
        qualityMode: prefs.qualityMode,
        temperature: prefs.temperature,
        maxTokens: prefs.maxTokens,
        customInstructions: prefs.customInstructions || undefined,
      };

      const appendThinking = (step: ThinkingStep) => {
        setThinkingSteps((prev) => {
          const exists = prev.some((s) => s.phase === step.phase && s.label === step.label);
          if (exists) return prev;
          return [...prev, step];
        });
      };

      if (prefs.streamingEnabled) {
        const result = await client.chatStream(outgoing, {
          ...requestOptions,
          onThinking: (step) => appendThinking(step as ThinkingStep),
          onToken: (tokenChunk) => {
            setStreaming(true);
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantId
                  ? { ...message, content: message.content + tokenChunk, model: "streaming" }
                  : message
              )
            );
          },
        });

        setSessionId(result.session_id);
        setStoredSessionId(result.session_id);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, model: result.model, latency_ms: result.latency_ms }
              : message
          )
        );
      } else {
        appendThinking({ phase: "analyze", label: "Processing request…", detail: prefs.qualityMode });
        const result = await client.chat(outgoing, requestOptions);
        if (result.reasoning_chain?.length) {
          result.reasoning_chain.forEach((label, i) =>
            appendThinking({ phase: `reason-${i}`, label, detail: "Reasoning trace" })
          );
        }
        setSessionId(result.session_id);
        setStoredSessionId(result.session_id);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: result.response,
                  model: result.model,
                  latency_ms: result.latency_ms,
                }
              : message
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setInput(outgoing);
      setMessages((prev) => prev.filter((message) => message.id !== assistantId));
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  function handleNewSession() {
    clearStoredSessionId();
    setSessionId(null);
    setMessages([]);
    setThinkingSteps([]);
    setError(null);
  }

  if (!token) return null;

  return (
    <AppShell>
      <div className="flex h-full min-h-0">
        {sidebarOpen ? (
          <aside className="veyra-glass flex w-72 shrink-0 flex-col border-r border-white/5">
            <div className="border-b border-white/5 p-4">
              <Button
                className="w-full gap-2 bg-violet-600 hover:bg-violet-500"
                onClick={handleNewSession}
              >
                <IconPlus className="h-4 w-4" />
                New chat
              </Button>
            </div>
            <div className="border-b border-white/5 p-4">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Project
              </label>
              <select
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:ring-2 focus:ring-violet-500/50"
                value={projectId || ""}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setStoredProjectId(event.target.value);
                }}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={useRag}
                  onChange={(e) => setUseRag(e.target.checked)}
                  className="rounded border-zinc-600 bg-zinc-900 text-violet-600"
                />
                Use project knowledge (RAG)
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {sessions.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-zinc-600">No conversations yet</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      setSessionId(session.id);
                      setStoredSessionId(session.id);
                    }}
                    className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      sessionId === session.id
                        ? "bg-violet-600/20 text-violet-100 ring-1 ring-violet-500/30"
                        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                    }`}
                  >
                    <p className="truncate font-medium">{session.title}</p>
                    <p className="mt-0.5 text-[10px] text-zinc-600">
                      {new Date(session.updated_at).toLocaleString()}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/5 px-5 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              >
                {sidebarOpen ? "Hide" : "Show"} sidebar
              </button>
              <div>
                <h1 className="text-sm font-semibold text-zinc-100">Veyra Chat</h1>
                <p className="text-xs text-zinc-500">
                  {sessionId ? `Session ${sessionId.slice(0, 8)}…` : "New session"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BrainWave active={loading} className="h-5" />
              <button
                type="button"
                onClick={() => {
                  clearStoredToken();
                  router.push("/login");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
            {messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-cyan-500/20 ring-1 ring-violet-500/20">
                  <IconSpark className="h-8 w-8 text-violet-300" />
                </div>
                <h2 className="mb-2 text-2xl font-semibold text-zinc-100">How can Veyra help?</h2>
                <p className="mb-8 max-w-md text-sm text-zinc-500">
                  Plan architectures, write code, debug systems, and orchestrate tasks — with visible
                  neural reasoning as it thinks.
                </p>
                <div className="grid w-full gap-2 sm:grid-cols-1">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSubmit(undefined, s)}
                      className="rounded-xl border border-white/5 bg-zinc-900/50 px-4 py-3 text-left text-sm text-zinc-400 transition-colors hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-zinc-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-6">
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  const isStreaming =
                    message.role === "assistant" && loading && message.id.startsWith("local-assistant");
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isUser
                            ? "bg-zinc-800 text-zinc-300"
                            : "bg-gradient-to-br from-violet-600 to-cyan-600 text-white"
                        }`}
                      >
                        {isUser ? <IconUser className="h-4 w-4" /> : <IconBrain className="h-4 w-4" />}
                      </div>
                      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
                        <div
                          className={`inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            isUser
                              ? "bg-zinc-800 text-zinc-100"
                              : "bg-zinc-900/80 text-zinc-200 ring-1 ring-white/5"
                          }`}
                        >
                          {message.content ? (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          ) : isStreaming ? (
                            <div className="flex items-center gap-3 text-zinc-500">
                              <BrainWave active className="h-5" />
                              <span className="text-xs">Synthesizing response…</span>
                            </div>
                          ) : null}
                        </div>
                        {!isUser && showMeta && message.model && message.model !== "processing" ? (
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {message.model}
                            {message.latency_ms ? ` · ${message.latency_ms}ms` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-white/5 bg-zinc-950/80 px-4 py-4 backdrop-blur-xl md:px-8">
            <div className="mx-auto max-w-3xl space-y-3">
              <ThinkingPanel steps={thinkingSteps} active={loading} />
              {error ? (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
              ) : null}
              <form onSubmit={handleSubmit} className="veyra-input-glow flex items-end gap-2 rounded-2xl border border-white/10 bg-zinc-900/80 p-2 transition-shadow">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder="Message Veyra…"
                  rows={1}
                  disabled={loading}
                  className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                <Button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="h-10 w-10 shrink-0 rounded-xl bg-violet-600 p-0 hover:bg-violet-500 disabled:opacity-40"
                >
                  <IconSend className="mx-auto h-4 w-4" />
                </Button>
              </form>
              <p className="text-center text-[10px] text-zinc-600">
                Veyra may take a moment with local models · Shift+Enter for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}