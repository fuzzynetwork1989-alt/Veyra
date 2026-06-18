"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@veyra/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@veyra/ui";
import { createApiClient } from "@/lib/api";
import { setStoredTokens } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);

  useEffect(() => {
    createApiClient()
      .getOAuthProviders()
      .then((res) => setOauthProviders(res.providers))
      .catch(() => setOauthProviders([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const client = createApiClient();
      const auth =
        mode === "login"
          ? await client.login(email, password)
          : await client.register(email, password);

      setStoredTokens(auth.access_token, auth.refresh_token);
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setLoading(true);
    try {
      const client = createApiClient();
      const { url } =
        provider === "google"
          ? await client.getGoogleOAuthUrl()
          : await client.getGitHubOAuthUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OAuth unavailable");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Sign in to Veyra" : "Create your Veyra account"}</CardTitle>
          <CardDescription>
            Access chat, memory, and agentic workflows from the web app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
          {oauthProviders.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-center text-xs text-slate-500">Or continue with</p>
              {oauthProviders.includes("google") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => handleOAuth("google")}
                >
                  Google
                </Button>
              ) : null}
              {oauthProviders.includes("github") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                  onClick={() => handleOAuth("github")}
                >
                  GitHub
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-blue-600 hover:underline"
            >
              {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
            </button>
            <Link href="/" className="text-slate-500 hover:underline">
              Back home
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}