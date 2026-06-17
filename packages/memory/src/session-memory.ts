import Redis from "ioredis";
import { MemoryEntry, MemoryType, MemoryStore, MemoryQuery } from "./types";

export class SessionMemory implements MemoryStore {
  private redis: Redis;
  private prefix: string = "veyra:session:";

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redis = new Redis(redisUrl);
  }

  async add(entry: MemoryEntry): Promise<void> {
    if (entry.type !== MemoryType.SESSION) {
      throw new Error("SessionMemory only accepts session-type entries");
    }
    if (!entry.sessionId) {
      throw new Error("SessionMemory requires sessionId");
    }

    const key = this.prefix + entry.sessionId;
    const data = JSON.stringify(entry);
    
    await this.redis.hset(key, entry.id, data);
    await this.redis.expire(key, 86400); // 24 hours TTL
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    for (const key of keys) {
      const data = await this.redis.hget(key, id);
      if (data) {
        return JSON.parse(data);
      }
    }
    return null;
  }

  async query(query: MemoryQuery): Promise<MemoryEntry[]> {
    if (!query.sessionId) {
      return [];
    }

    const key = this.prefix + query.sessionId;
    const entries = await this.redis.hvals(key);
    
    return entries
      .map((data) => JSON.parse(data) as MemoryEntry)
      .filter((entry) => {
        if (query.type && entry.type !== query.type) return false;
        return true;
      })
      .slice(0, query.limit || 100);
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Memory entry ${id} not found`);
    }

    const updated: MemoryEntry = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date(),
    };

    await this.add(updated);
  }

  async delete(id: string): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    for (const key of keys) {
      await this.redis.hdel(key, id);
    }
  }

  async clearSession(sessionId: string): Promise<void> {
    const key = this.prefix + sessionId;
    await this.redis.del(key);
  }

  async clearProject(projectId: string): Promise<void> {
    // Session memory doesn't have project-level clearing
    // This is a no-op for session memory
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
