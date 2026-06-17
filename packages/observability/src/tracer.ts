import Redis from "ioredis";
import { Span } from "./types";
import { v4 as uuidv4 } from "uuid";

export class Tracer {
  private redis: Redis;
  private prefix: string = "veyra:traces:";
  private activeSpans: Map<string, Span> = new Map();

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redis = new Redis(redisUrl);
  }

  startSpan(operation: string, parentSpanId?: string): Span {
    const span: Span = {
      traceId: parentSpanId ? this.getTraceId(parentSpanId) : uuidv4(),
      spanId: uuidv4(),
      parentSpanId,
      operation,
      startTime: new Date(),
      tags: {},
      logs: [],
    };
    
    this.activeSpans.set(span.spanId, span);
    return span;
  }

  finishSpan(spanId: string): Span | null {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;
    
    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    
    this.activeSpans.delete(spanId);
    this.persistSpan(span);
    
    return span;
  }

  addTag(spanId: string, key: string, value: string): void {
    const span = this.activeSpans.get(spanId);
    if (span && span.tags) {
      span.tags[key] = value;
    }
  }

  addLog(spanId: string, message: string): void {
    const span = this.activeSpans.get(spanId);
    if (span && span.logs) {
      span.logs.push({
        level: "info" as any,
        message,
        timestamp: new Date(),
      });
    }
  }

  async getTrace(traceId: string): Promise<Span[]> {
    const key = this.prefix + traceId;
    const spans = await this.redis.lrange(key, 0, -1);
    return spans.map((s) => JSON.parse(s) as Span);
  }

  private async persistSpan(span: Span): Promise<void> {
    const key = this.prefix + span.traceId;
    await this.redis.lpush(key, JSON.stringify(span));
    await this.redis.expire(key, 86400); // 24 hours TTL
  }

  private getTraceId(spanId: string): string {
    // In a real implementation, this would look up the span to get its traceId
    // For now, we'll use the spanId as a fallback
    return spanId;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
