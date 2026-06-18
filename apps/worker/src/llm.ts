const BASE_URL = (process.env.OPENAI_BASE_URL || "http://127.0.0.1:1234/v1").replace(/\/$/, "");
const API_KEY = process.env.OPENAI_API_KEY || "lm-studio";
const CONFIGURED_MODEL = process.env.OPENAI_MODEL || "";
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_SECONDS || "600") * 1000;

const EMBEDDING_MARKERS = ["embed", "embedding"];

let cachedModelId: string | null = null;

async function resolveModelId(): Promise<string> {
  if (CONFIGURED_MODEL) return CONFIGURED_MODEL;
  if (cachedModelId) return cachedModelId;

  const response = await fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to list models (${response.status})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  const models = payload.data || [];
  const chatModel = models.find(
    (model) => model.id && !EMBEDDING_MARKERS.some((m) => model.id.toLowerCase().includes(m))
  );
  if (!chatModel?.id) {
    throw new Error(`No chat models available at ${BASE_URL}`);
  }

  cachedModelId = chatModel.id;
  return chatModel.id;
}

export interface LlmCompletion {
  content: string;
  model: string;
  tokensUsed: number;
}

export async function completeChat(
  systemPrompt: string,
  userPrompt: string,
  options?: { maxTokens?: number; temperature?: number }
): Promise<LlmCompletion> {
  const model = await resolveModelId();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.4,
        max_tokens: options?.maxTokens ?? 1024,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
      model?: string;
    };

    return {
      content: data.choices?.[0]?.message?.content?.trim() || "",
      model: data.model || model,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  } finally {
    clearTimeout(timeout);
  }
}