import { VeyraClient } from "@veyra/sdk";
import { getSettings } from "./settings";

export function createApiClient(token?: string | null) {
  const settings = getSettings();
  return new VeyraClient({
    baseUrl: settings.apiUrl.replace(/\/$/, "") || "http://localhost:8000",
    apiKey: token || undefined,
    timeout: settings.apiTimeoutMs,
  });
}