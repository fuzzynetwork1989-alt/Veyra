"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createApiClient } from "@/lib/api";
import { setStoredTokens } from "@/lib/auth";

export function GitHubOAuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Missing OAuth code");
      return;
    }

    const client = createApiClient();
    client
      .completeGitHubOAuth(code)
      .then((auth) => {
        setStoredTokens(auth.access_token, auth.refresh_token);
        router.replace("/chat");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "GitHub sign-in failed");
      });
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-slate-600">Completing GitHub sign-in...</p>
    </main>
  );
}