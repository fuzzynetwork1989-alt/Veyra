"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@veyra/ui";
import { ChatHistoryMessage } from "@veyra/sdk";
import { createApiClient } from "@/lib/api";
import {
  clearStoredSessionId,
  clearStoredToken,
  getStoredSessionId,
  getStoredToken,
  setStoredSessionId,
} from "@/lib/auth";

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [input, setInput] = useState("");
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
  }, [router]);

  useEffect(() => {
    if (!token || !sessionId) {
      return;
    }

    let cancelled = false;
    async function loadHistory() {
      try {
        const history = await client.getChatHistory(sessionId);
        if (!cancelled) {
          setMessages(history.messages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chat history");
        }
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [client, token, sessionId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !token) {
      return;
    }

    setLoading(true);
    setError(null);
    const outgoing = input.trim();
    setInput("");

    try {
      const response = await client.chat(outgoing, { sessionId: sessionId || undefined });
      setSessionId(response.session_id);
      setStoredSessionId(response.session_id);

      const history = await client.getChatHistory(response.session_id);
      setMessages(history.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setInput(outgoing);
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

  if (!token) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto flex h-screen max-w-4xl flex-col px-4 py-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Veyra Chat</h1>
            <p className="text-sm text-slate-500">
              {sessionId ? `Session ${sessionId.slice(0, 8)}...` : "New session"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleNewSession}>
              New session
            </Button>
            <Button variant="ghost" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </header>

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
                  <p className="mb-1 text-xs font-medium uppercase opacity-70">{message.role}</p>
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
            <Link href="/" className="text-sm text-slate-500 hover:underline">
              Back home
            </Link>
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? "Thinking... (local models can take a few minutes)" : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}