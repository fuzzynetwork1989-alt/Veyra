"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@veyra/ui";
import { IconGithub, IconGoogle, IconLock, IconMail, IconSpark } from "@/components/icons";
import { createApiClient } from "@/lib/api";
import { setStoredTokens } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    const settings = getSettings();
    const apiUrl = settings.apiUrl.replace(/\/$/, "");
    fetch(`${apiUrl}/`)
      .then((res) => setApiStatus(res.ok ? "online" : "offline"))
      .catch(() => setApiStatus("offline"));

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
          ? await client.login(email.trim(), password)
          : await client.register(email.trim(), password);

      setStoredTokens(auth.access_token, auth.refresh_token);
      router.push("/chat/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        setError(
          `Cannot reach API at ${getSettings().apiUrl}. Start the Veyra API (port 8000) and try again.`
        );
      } else if (message.includes("401")) {
        setError("Invalid email or password. Try registering a new account.");
      } else if (message.includes("409")) {
        setError("An account with this email already exists. Sign in instead.");
      } else {
        setError(message.replace(/^Veyra API error: \d+ [^ ]+ /, ""));
      }
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
    <div className="veyra-mesh relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -right-24 bottom-1/4 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-2xl shadow-violet-600/30">
            <IconSpark className="h-8 w-8 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            Veyra
          </h1>
          <p className="mt-2 text-sm text-zinc-500">Next-gen AI for builders</p>
        </div>

        <div className="veyra-glass rounded-2xl p-6 shadow-2xl shadow-black/40">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-100">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {mode === "login"
                ? "Sign in to access chat, agents, and memory"
                : "Join Veyra and start building with AI"}
            </p>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-lg border border-white/5 bg-zinc-900/50 px-3 py-2 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                apiStatus === "online"
                  ? "bg-emerald-400"
                  : apiStatus === "offline"
                    ? "bg-red-400"
                    : "animate-pulse bg-amber-400"
              }`}
            />
            <span className="text-zinc-500">
              API {apiStatus === "online" ? "connected" : apiStatus === "offline" ? "unreachable" : "checking"}
              {" · "}
              {getSettings().apiUrl}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Email
              </label>
              <div className="veyra-input-glow flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-3 transition-shadow">
                <IconMail className="h-4 w-4 shrink-0 text-zinc-600" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Password
              </label>
              <div className="veyra-input-glow flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-3 transition-shadow">
                <IconLock className="h-4 w-4 shrink-0 text-zinc-600" />
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-sm font-medium hover:from-violet-500 hover:to-violet-400"
              disabled={loading || apiStatus === "offline"}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          {oauthProviders.length > 0 ? (
            <div className="mt-5 space-y-2">
              <p className="text-center text-xs text-zinc-600">Or continue with</p>
              {oauthProviders.includes("google") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full gap-2 rounded-xl border-white/10 bg-zinc-900/50 hover:bg-white/5"
                  disabled={loading}
                  onClick={() => handleOAuth("google")}
                >
                  <IconGoogle className="h-4 w-4" />
                  Google
                </Button>
              ) : null}
              {oauthProviders.includes("github") ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full gap-2 rounded-xl border-white/10 bg-zinc-900/50 hover:bg-white/5"
                  disabled={loading}
                  onClick={() => handleOAuth("github")}
                >
                  <IconGithub className="h-4 w-4" />
                  GitHub
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4 text-sm">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              className="text-violet-400 transition-colors hover:text-violet-300"
            >
              {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
            </button>
            <Link href="/" className="text-zinc-500 transition-colors hover:text-zinc-300">
              ← Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}