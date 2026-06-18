import { VeyraClient } from "@veyra/sdk";

const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const timeout = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || "300000");

export function createApiClient(token?: string | null) {
  return new VeyraClient({
    baseUrl,
    apiKey: token || undefined,
    timeout,
  });
}