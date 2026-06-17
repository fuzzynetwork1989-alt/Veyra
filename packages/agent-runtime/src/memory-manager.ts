import { Task, AgentContext } from "./types";

export class MemoryManager {
  private memory: Map<string, any> = new Map();

  async enrichContext(task: Task, context: AgentContext): Promise<AgentContext> {
    // Retrieve relevant memory for this task
    const sessionMemory = this.memory.get(`session:${task.sessionId}`);
    const projectMemory = this.memory.get(`project:${task.projectId}`);
    const userProfile = this.memory.get(`user:${task.userId}`);

    return {
      ...context,
      memory: {
        session: sessionMemory,
        project: projectMemory,
        userProfile,
      },
    };
  }

  async storeMemory(
    key: string,
    value: any,
    type: "session" | "project" | "user",
    id: string
  ): Promise<void> {
    const memoryKey = `${type}:${id}`;
    const existing = this.memory.get(memoryKey) || {};
    
    this.memory.set(memoryKey, {
      ...existing,
      [key]: value,
      timestamp: new Date(),
    });
  }

  async clearMemory(type: "session" | "project" | "user", id: string): Promise<void> {
    const memoryKey = `${type}:${id}`;
    this.memory.delete(memoryKey);
  }

  shouldStore(output: any): boolean {
    // Decide whether to store output in memory
    // Store if output is substantial and not an error
    if (!output) return false;
    if (typeof output === "string" && output.length < 50) return false;
    return true;
  }
}
