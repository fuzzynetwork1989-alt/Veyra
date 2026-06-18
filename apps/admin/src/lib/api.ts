import { VeyraClient } from "@veyra/sdk";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function createApiClient(token?: string) {
  const client = new VeyraClient({ baseUrl: API_URL });
  if (token) client.setApiKey(token);
  return client;
}