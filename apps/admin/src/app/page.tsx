"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@veyra/ui";
import { AdminStats, AdminTaskSummary, AdminUserSummary, VeyraClient } from "@veyra/sdk";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AdminDashboard() {
  const [token, setToken] = useState("");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [tasks, setTasks] = useState<AdminTaskSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => {
    const instance = new VeyraClient({ baseUrl: API_URL });
    if (token) instance.setApiKey(token);
    return instance;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    setError(null);
    Promise.all([client.getAdminStats(), client.getAdminUsers(), client.getAdminTasks()])
      .then(([statsData, usersData, tasksData]) => {
        setStats(statsData);
        setUsers(usersData);
        setTasks(tasksData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load admin data"));
  }, [client, token]);

  const healthStatus =
    (stats?.health as { status?: string } | undefined)?.status || "unknown";

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold">Veyra Admin</h1>
          <p className="text-slate-600 dark:text-slate-400">Internal operations dashboard</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Admin token</CardTitle>
            <CardDescription>Paste a JWT for a user with the admin role</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Bearer token"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>

        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Registered accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.users ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks Running</CardTitle>
              <CardDescription>Pending + running</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.tasks_running ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage (24h)</CardTitle>
              <CardDescription>Tokens consumed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats?.usage_24h.tokens ?? 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>API component status</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`text-3xl font-bold ${
                  healthStatus === "healthy" ? "text-green-600" : "text-amber-600"
                }`}
              >
                {healthStatus}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>Recent accounts and 24h token usage</CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-400">No users loaded</p>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                      <p className="font-medium">{user.email}</p>
                      <p className="text-slate-500">
                        {user.role} · {user.tokens_24h} tokens (24h)
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Latest agent task activity</CardDescription>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-slate-600 dark:text-slate-400">No tasks loaded</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                      <p className="font-medium">{task.description.slice(0, 120)}</p>
                      <p className="text-slate-500">
                        {task.status} · {task.user_email}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}