import { VeyraClient } from "@veyra/sdk";
import { ensureValidToken } from "@/lib/auth-session";
import { getSettings } from "./settings";

export function createApiClient(token?: string | null) {
  const settings = getSettings();
  return new VeyraClient({
    baseUrl: settings.apiUrl.replace(/\/$/, "") || "http://localhost:8000",
    apiKey: token || undefined,
    timeout: settings.apiTimeoutMs,
  });
}

export async function createAuthenticatedClient(): Promise<VeyraClient | null> {
  const token = await ensureValidToken();
  if (!token) return null;
  return createApiClient(token);
}