export interface VeyraClientConfig {
  apiKey?: string;
  baseUrl: string;
  timeout?: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  role: string;
}

export interface UserProfile {
  user_id: string;
  email: string;
  role: string;
}

export class VeyraClient {
  private config: VeyraClientConfig;

  constructor(config: VeyraClientConfig) {
    this.config = {
      timeout: 300000,
      ...config,
    };
  }

  setApiKey(apiKey: string) {
    this.config.apiKey = apiKey;
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }

  async me(): Promise<UserProfile> {
    const response = await this.request("/auth/me", {
      method: "GET",
      headers: this.authHeaders(),
    });
    return response.json();
  }

  async chat(message: string, options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.request(
      "/chat/",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeaders(),
        },
        body: JSON.stringify({
          message,
          session_id: options?.sessionId,
          max_tokens: options?.maxTokens,
          temperature: options?.temperature,
          quality_mode: options?.qualityMode,
          use_rag: options?.useRag,
          use_agents: options?.useAgents,
        }),
      },
      options?.timeoutMs
    );

    return response.json();
  }

  async getChatHistory(sessionId: string): Promise<ChatHistoryResponse> {
    const params = new URLSearchParams({ session_id: sessionId });
    const response = await this.request(`/chat/history?${params.toString()}`, {
      method: "GET",
      headers: this.authHeaders(),
    });
    return response.json();
  }

  async addMemory(documents: string[], metadata?: Record<string, any>): Promise<void> {
    await this.request("/memory/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        documents,
        metadata,
      }),
    });
  }

  async retrieveMemory(query: string, topK?: number): Promise<MemoryRetrieveResponse> {
    const params = new URLSearchParams({
      query,
      top_k: (topK || 5).toString(),
    });

    const response = await this.request(`/memory/retrieve?${params}`, {
      method: "GET",
      headers: this.authHeaders(),
    });

    return response.json();
  }

  async executeTask(task: string, context?: Record<string, any>): Promise<any> {
    const response = await this.request("/tasks/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        description: task,
        context: context || {},
      }),
    });

    return response.json();
  }

  async getTaskStatus(taskId: string): Promise<any> {
    const response = await this.request(`/tasks/${taskId}`, {
      method: "GET",
      headers: this.authHeaders(),
    });

    return response.json();
  }

  private authHeaders(): Record<string, string> {
    if (!this.config.apiKey) {
      throw new Error("API key is required for authenticated requests");
    }
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    };
  }

  private async request(
    path: string,
    options: RequestInit,
    timeoutMs?: number
  ): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    const timeout = timeoutMs ?? this.config.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Veyra API error: ${response.status} ${response.statusText} ${errorBody}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Request timed out after ${Math.round(timeout / 1000)}s. Local models can be slow — try again or increase the client timeout.`
        );
      }
      throw error;
    }
  }
}

export interface ChatOptions {
  sessionId?: string;
  maxTokens?: number;
  temperature?: number;
  qualityMode?: "fast" | "balanced" | "deep";
  useRag?: boolean;
  useAgents?: boolean;
  timeoutMs?: number;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  tokens_used: number;
  model: string;
  reasoning_chain?: string[];
  trace?: Record<string, any>;
  retrieved_docs?: Array<{
    content: string;
    metadata: Record<string, any>;
    distance: number;
  }>;
}

export interface ChatHistoryMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface ChatHistoryResponse {
  session_id: string;
  messages: ChatHistoryMessage[];
}

export interface MemoryRetrieveResponse {
  results: Array<Record<string, any>>;
  query: string;
  top_k: number;
}