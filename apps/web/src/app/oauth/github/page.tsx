import { Suspense } from "react";
import { GitHubOAuthCallback } from "./callback";

export default function GitHubOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
          <p className="text-sm text-slate-600">Completing GitHub sign-in...</p>
        </main>
      }
    >
      <GitHubOAuthCallback />
    </Suspense>
  );
}