"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@veyra/ui";
import { ChatHistoryMessage, ChatSessionSummary, ProjectSummary } from "@veyra/sdk";
import { AppShell } from "@/components/app-shell";
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

export default function ChatPage() {
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);

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
      .then((items) => {
        setProjects(items);
        if (!projectId && items[0]) {
          setProjectId(items[0].id);
          setStoredProjectId(items[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects"));
  }, [client, token, projectId]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !token) return;

    setLoading(true);
    setError(null);
    const outgoing = input.trim();
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
      model: "streaming",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const prefs = getSettings();
      const streamFn = prefs.streamingEnabled ? client.chatStream.bind(client) : null;
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

      if (!streamFn) {
        const result = await client.chat(outgoing, requestOptions);
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
        return;
      }

      const result = await streamFn(outgoing, {
        ...requestOptions,
        onToken: (tokenChunk) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId
                ? { ...message, content: message.content + tokenChunk }
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
            ? {
                ...message,
                model: result.model,
                latency_ms: result.latency_ms,
              }
            : message
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setInput(outgoing);
      setMessages((prev) => prev.filter((message) => message.id !== assistantId));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File | null) {
    if (!file || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      await client.uploadDocument(projectId, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    clearStoredToken();
    clearStoredSessionId();
    router.push("/login");
  }

  function handleNewSession() {
    clearStoredSessionId();
    setSessionId(null);
    setMessages([]);
  }

  if (!token) return null;

  return (
    <AppShell>
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-6xl md:h-screen">
        <aside className="w-72 border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Sessions</h2>
            <Button size="sm" variant="outline" onClick={handleNewSession}>
              New
            </Button>
          </div>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">Project</label>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
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
          </div>
          <div className="space-y-2 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setSessionId(session.id);
                  setStoredSessionId(session.id);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  sessionId === session.id
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                <p className="truncate font-medium">{session.title}</p>
                <p className="text-xs opacity-70">{new Date(session.updated_at).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-1 flex-col px-4 py-6">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Veyra Chat</h1>
              <p className="text-sm text-slate-500">
                {sessionId ? `Session ${sessionId.slice(0, 8)}...` : "New session"}
              </p>
            </div>
            <Button variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </header>

          <div className="mb-3 flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useRag} onChange={(e) => setUseRag(e.target.checked)} />
              Use project documents (RAG)
            </label>
            <label className="cursor-pointer text-blue-600 hover:underline">
              Upload .txt
              <input
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0] || null)}
              />
            </label>
          </div>

          <section className="flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Start a conversation to plan, build, or debug your next task.
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-lg px-4 py-3 text-sm ${
                      message.role === "user"
                        ? "ml-12 bg-blue-600 text-white"
                        : "mr-12 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs uppercase opacity-70">
                      <span>{message.role}</span>
                      {message.role === "assistant" && showMeta && (
                        <span>
                          {message.model || "model"}
                          {message.latency_ms ? ` · ${message.latency_ms}ms` : ""}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <form onSubmit={handleSubmit} className="mt-4 space-y-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Veyra to help plan, implement, or review something..."
              rows={3}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex items-center justify-between">
              <Link href="/settings" className="text-sm text-slate-500 hover:underline">
                Settings
              </Link>
              <Button type="submit" disabled={loading || !input.trim()}>
                {loading ? "Thinking... (local models can take a few minutes)" : "Send"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
    </AppShell>
  );
}