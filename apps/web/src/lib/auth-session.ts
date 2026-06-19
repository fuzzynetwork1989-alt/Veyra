import { createApiClient } from "@/lib/api";
import {
  clearStoredToken,
  getStoredRefreshToken,
  getStoredToken,
  setStoredTokens,
} from "@/lib/auth";
import { getSettings } from "@/lib/settings";

let refreshPromise: Promise<string | null> | null = null;

export async function ensureValidToken(): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;

  if (!getSettings().autoRefreshToken) return token;

  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    const expMs = (payload.exp as number) * 1000;
    const refreshInMs = expMs - Date.now();
    if (refreshInMs > 5 * 60 * 1000) return token;
  } catch {
    return token;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refresh = getStoredRefreshToken();
      if (!refresh) return token;
      try {
        const client = createApiClient();
        const auth = await client.refresh(refresh);
        setStoredTokens(auth.access_token, auth.refresh_token);
        return auth.access_token;
      } catch {
        clearStoredToken();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function logoutSession(): Promise<void> {
  const refresh = getStoredRefreshToken();
  if (refresh) {
    try {
      await createApiClient(getStoredToken()).logout(refresh);
    } catch {
      /* best effort */
    }
  }
  clearStoredToken();
}