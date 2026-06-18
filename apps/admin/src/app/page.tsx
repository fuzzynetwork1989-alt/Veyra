"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@veyra/ui";
import { AdminStats, AdminTaskSummary, AdminUserSummary, QuotaConfig } from "@veyra/sdk";
import { createApiClient } from "@/lib/api";
import { clearStoredTokens, getStoredToken } from "@/lib/auth";

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [quotas, setQuotas] = useState<QuotaConfig | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [tasks, setTasks] = useState<AdminTaskSummary[]>([]);
  const [quotaForm, setQuotaForm] = useState({ tokens: "", chats: "", tasks: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const client = useMemo(() => createApiClient(token || undefined), [token]);

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) {
      router.replace("/login");
      return;
    }
    setToken(stored);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    setError(null);
    Promise.all([
      client.getAdminStats(),
      client.getAdminQuotas(),
      client.getAdminUsers(),
      client.getAdminTasks(),
    ])
      .then(([statsData, quotaData, usersData, tasksData]) => {
        setStats(statsData);
        setQuotas(quotaData);
        setUsers(usersData);
        setTasks(tasksData);
        setQuotaForm({
          tokens: String(quotaData.effective.tokens),
          chats: String(quotaData.effective.chats),
          tasks: String(quotaData.effective.tasks),
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load admin data");
        if (String(err).includes("403")) {
          clearStoredTokens();
          router.replace("/login");
        }
      });
  }, [client, token, router]);

  async function handleQuotaSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await client.updateAdminQuotas({
        tokens: Number(quotaForm.tokens),
        chats: Number(quotaForm.chats),
        tasks: Number(quotaForm.tasks),
      });
      setQuotas((prev) =>
        prev
          ? { ...prev, effective: updated.effective, source: updated.source }
          : { effective: updated.effective, defaults: updated.effective, source: updated.source }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save quotas");
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    clearStoredTokens();
    router.replace("/login");
  }

  if (!token) return null;

  const healthStatus =
    (stats?.health as { status?: string } | undefined)?.status || "unknown";
  const embeddings = (
    stats?.health as { components?: { embeddings?: { status?: string; configured_model?: string } } }
  )?.components?.embeddings;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">Veyra Admin</h1>
            <p className="text-slate-600 dark:text-slate-400">Operations dashboard</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.users ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tasks Running</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.tasks_running ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Usage (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.usage_24h.tokens ?? 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${healthStatus === "healthy" ? "text-green-600" : "text-amber-600"}`}>
                {healthStatus}
              </div>
              {embeddings ? (
                <p className="mt-2 text-xs text-slate-500">
                  Embeddings: {embeddings.status}
                  {embeddings.configured_model ? ` (${embeddings.configured_model})` : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Daily quotas</CardTitle>
            <CardDescription>
              Overrides env defaults (source: {quotas?.source || "env"})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleQuotaSave} className="grid gap-4 md:grid-cols-4">
              <input
                type="number"
                value={quotaForm.tokens}
                onChange={(e) => setQuotaForm((f) => ({ ...f, tokens: e.target.value }))}
                placeholder="Token quota"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                value={quotaForm.chats}
                onChange={(e) => setQuotaForm((f) => ({ ...f, chats: e.target.value }))}
                placeholder="Chat quota"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <input
                type="number"
                value={quotaForm.tasks}
                onChange={(e) => setQuotaForm((f) => ({ ...f, tasks: e.target.value }))}
                placeholder="Task quota"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save quotas"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">{user.email}</p>
                  <p className="text-slate-500">
                    {user.role} · {user.tokens_24h} tokens (24h)
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium">{task.description.slice(0, 120)}</p>
                  <p className="text-slate-500">
                    {task.status} · {task.user_email}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}