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
          project_id: options?.projectId,
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

  async chatStream(
    message: string,
    options?: ChatStreamOptions
  ): Promise<ChatStreamResult> {
    const url = `${this.config.baseUrl}/chat/stream`;
    const timeout = options?.timeoutMs ?? this.config.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        message,
        session_id: options?.sessionId,
        project_id: options?.projectId,
        max_tokens: options?.maxTokens,
        temperature: options?.temperature,
        quality_mode: options?.qualityMode,
        use_rag: options?.useRag,
        use_agents: options?.useAgents,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Veyra API error: ${response.status} ${response.statusText} ${errorBody}`);
    }

    if (!response.body) {
      throw new Error("Streaming response body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sessionId = options?.sessionId || "";
    let fullResponse = "";
    let model = "unknown";
    let latencyMs = 0;
    let tokensUsed = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          if (line.startsWith("data:")) data = line.slice(5).trim();
        }
        if (!data) continue;

        const payload = JSON.parse(data);
        if (event === "meta") {
          sessionId = payload.session_id || sessionId;
          options?.onMeta?.(payload);
        } else if (event === "token") {
          fullResponse += payload.content;
          options?.onToken?.(payload.content);
        } else if (event === "done") {
          sessionId = payload.session_id || sessionId;
          model = payload.model || model;
          latencyMs = payload.latency_ms || 0;
          tokensUsed = payload.tokens_used || 0;
        } else if (event === "error") {
          throw new Error(payload.detail || "Stream error");
        }
      }
    }

    const result: ChatStreamResult = {
      response: fullResponse,
      session_id: sessionId,
      model,
      latency_ms: latencyMs,
      tokens_used: tokensUsed,
    };
    options?.onDone?.(result);
    return result;
  }

  async getAdminStats(): Promise<AdminStats> {
    const response = await this.request("/admin/stats", {
      method: "GET",
      headers: this.authHeaders(),
    });
    return response.json();
  }

  async getAdminUsers(): Promise<AdminUserSummary[]> {
    const response = await this.request("/admin/users", {
      method: "GET",
      headers: this.authHeaders(),
    });
    return response.json();
  }

  async getAdminTasks(): Promise<AdminTaskSummary[]> {
    const response = await this.request("/admin/tasks", {
      method: "GET",
      headers: this.authHeaders(),
    });
    return response.json();
  }

  async listChatSessions(projectId?: string): Promise<ChatSessionSummary[]> {
    const params = projectId ? new URLSearchParams({ project_id: projectId }) : "";
    const response = await this.request(
      `/chat/sessions${params ? `?${params.toString()}` : ""}`,
      { method: "GET", headers: this.authHeaders() }
    );
    return response.json();
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const response = await this.request("/projects/", {
      method: "GET",
      headers: this.authHeaders(),
    });
    return response.json();
  }

  async createProject(name: string, description?: string): Promise<ProjectSummary> {
    const response = await this.request("/projects/", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.authHeaders() },
      body: JSON.stringify({ name, description }),
    });
    return response.json();
  }

  async uploadDocument(projectId: string, file: File): Promise<any> {
    const form = new FormData();
    form.append("project_id", projectId);
    form.append("file", file);
    const response = await this.request("/documents/upload", {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
    });
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

  async executeTask(
    task: string,
    options?: { context?: Record<string, any>; projectId?: string; priority?: string }
  ): Promise<TaskResponse> {
    const response = await this.request("/tasks/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.authHeaders(),
      },
      body: JSON.stringify({
        description: task,
        context: options?.context || {},
        project_id: options?.projectId,
        priority: options?.priority || "medium",
      }),
    });

    return response.json();
  }

  async getTaskStatus(taskId: string): Promise<TaskResponse> {
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
  projectId?: string;
  maxTokens?: number;
  temperature?: number;
  qualityMode?: "fast" | "balanced" | "deep";
  useRag?: boolean;
  useAgents?: boolean;
  timeoutMs?: number;
}

export interface ChatStreamOptions extends ChatOptions {
  onMeta?: (meta: Record<string, unknown>) => void;
  onToken?: (token: string) => void;
  onDone?: (result: ChatStreamResult) => void;
}

export interface ChatStreamResult {
  response: string;
  session_id: string;
  model: string;
  latency_ms: number;
  tokens_used: number;
}

export interface AdminStats {
  users: number;
  tasks_running: number;
  tasks_total: number;
  usage_24h: { tokens: number; events: number };
  health: Record<string, unknown>;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  role: string;
  created_at: string;
  tokens_24h: number;
}

export interface AdminTaskSummary {
  id: string;
  description: string;
  status: string;
  priority: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export interface ChatResponse {
  response: string;
  session_id: string;
  tokens_used: number;
  model: string;
  latency_ms?: number;
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
  model?: string | null;
  latency_ms?: number | null;
}

export interface ChatSessionSummary {
  id: string;
  title: string;
  project_id?: string | null;
  updated_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
}

export interface TaskResponse {
  task_id: string;
  status: string;
  description: string;
  result?: Record<string, any> | null;
  error?: string | null;
  project_id?: string | null;
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