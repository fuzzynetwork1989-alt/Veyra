export interface VeyraClientConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

export class VeyraClient {
  private config: VeyraClientConfig;

  constructor(config: VeyraClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  async chat(message: string, options?: ChatOptions): Promise<ChatResponse> {
    const response = await this.request("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        message,
        ...options,
      }),
    });

    return response.json();
  }

  async addMemory(documents: string[], metadata?: Record<string, any>): Promise<void> {
    await this.request("/memory/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        documents,
        metadatas: metadata ? [metadata] : undefined,
      }),
    });
  }

  async retrieveMemory(query: string, topK?: number): Promise<any> {
    const params = new URLSearchParams({
      query,
      top_k: (topK || 5).toString(),
    });

    const response = await this.request(`/memory/retrieve?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    return response.json();
  }

  async executeTask(task: string, context?: Record<string, any>): Promise<any> {
    const response = await this.request("/tasks/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
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
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    return response.json();
  }

  private async request(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Veyra API error: ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

export interface ChatOptions {
  sessionId?: string;
  userId?: string;
  maxTokens?: number;
  temperature?: number;
  qualityMode?: "fast" | "balanced" | "deep";
  useRag?: boolean;
  useAgents?: boolean;
}

export interface ChatResponse {
  response: string;
  tokensUsed: number;
  model: string;
  reasoningChain?: string[];
  trace?: Record<string, any>;
  retrievedDocs?: Array<{
    content: string;
    metadata: Record<string, any>;
    distance: number;
  }>;
}
