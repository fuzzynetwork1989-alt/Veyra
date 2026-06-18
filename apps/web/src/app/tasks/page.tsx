"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@veyra/ui";
import { TaskResponse } from "@veyra/sdk";
import { AppShell } from "@/components/app-shell";
import { createApiClient } from "@/lib/api";
import { getStoredToken } from "@/lib/auth";
import { getStoredProjectId } from "@/lib/project";

export default function TasksPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [activeTask, setActiveTask] = useState<TaskResponse | null>(null);
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
  }, [router]);

  useEffect(() => {
    if (!activeTask || !token) return;
    if (activeTask.status === "completed" || activeTask.status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const latest = await client.getTaskStatus(activeTask.task_id);
        setActiveTask(latest);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to poll task");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeTask, client, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const created = await client.executeTask(description.trim(), {
        projectId: getStoredProjectId() || undefined,
      });
      setActiveTask(created);
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute task");
    } finally {
      setLoading(false);
    }
  }

  if (!token) return null;

  return (
    <AppShell>
    <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Agent Tasks</h1>
          <p className="text-sm text-slate-500">Submit work to the Veyra worker and agent runtime.</p>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="Describe a task for the agent to plan and execute..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={loading || !description.trim()}>
            {loading ? "Submitting..." : "Execute task"}
          </Button>
        </form>

        {activeTask ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-950">
            <p>
              <span className="font-medium">Task:</span> {activeTask.description}
            </p>
            <p>
              <span className="font-medium">Status:</span> {activeTask.status}
            </p>
            {activeTask.error ? (
              <p className="mt-2 text-red-600">{activeTask.error}</p>
            ) : null}
            {activeTask.result ? (
              <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs dark:bg-slate-900">
                {JSON.stringify(activeTask.result, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
    </AppShell>
  );
}