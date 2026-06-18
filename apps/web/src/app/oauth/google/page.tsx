import { Suspense } from "react";
import { GoogleOAuthCallback } from "./callback";

export default function GoogleOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-4">
          <p className="text-sm text-slate-600">Completing Google sign-in...</p>
        </main>
      }
    >
      <GoogleOAuthCallback />
    </Suspense>
  );
}