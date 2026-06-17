import Redis from "ioredis";
import { LogEntry, LogLevel } from "./types";

export class Logger {
  private redis: Redis;
  private prefix: string = "veyra:logs:";
  private service: string;

  constructor(
    service: string,
    redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379"
  ) {
    this.redis = new Redis(redisUrl);
    this.service = service;
  }

  async log(entry: LogEntry): Promise<void> {
    const key = this.prefix + this.service;
    const log = {
      ...entry,
      service: this.service,
    };
    
    await this.redis.lpush(key, JSON.stringify(log));
    
    // Keep only last 10000 logs
    await this.redis.ltrim(key, 0, 9999);
    
    // Also store by level for filtering
    const levelKey = `${this.prefix}level:${entry.level}`;
    await this.redis.lpush(levelKey, JSON.stringify(log));
    await this.redis.ltrim(levelKey, 0, 9999);
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date(),
      context,
    });
  }

  info(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.INFO,
      message,
      timestamp: new Date(),
      context,
    });
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.WARN,
      message,
      timestamp: new Date(),
      context,
    });
  }

  error(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.ERROR,
      message,
      timestamp: new Date(),
      context,
    });
  }

  fatal(message: string, context?: Record<string, any>): void {
    this.log({
      level: LogLevel.FATAL,
      message,
      timestamp: new Date(),
      context,
    });
  }

  async getLogs(level?: LogLevel, limit: number = 100): Promise<LogEntry[]> {
    const key = level 
      ? `${this.prefix}level:${level}`
      : `${this.prefix}${this.service}`;
    
    const logs = await this.redis.lrange(key, 0, limit - 1);
    return logs.map((l) => JSON.parse(l) as LogEntry);
  }

  async withContext<T>(
    context: Record<string, any>,
    fn: () => Promise<T>
  ): Promise<T> {
    const result = await fn();
    return result;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
