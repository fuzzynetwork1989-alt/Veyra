import Redis from "ioredis";
import { Metric } from "./types";

export class MetricsCollector {
  private redis: Redis;
  private prefix: string = "veyra:metrics:";

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redis = new Redis(redisUrl);
  }

  async recordMetric(metric: Metric): Promise<void> {
    const key = this.prefix + metric.name;
    const value = metric.value.toString();
    const timestamp = metric.timestamp.getTime().toString();
    
    // Store metric with timestamp
    await this.redis.zadd(key, timestamp, JSON.stringify(metric));
    
    // Keep only last 1000 metrics per name
    await this.redis.zremrangebyrank(key, 0, -1001);
    
    // Update labels index
    if (metric.labels) {
      for (const [labelKey, labelValue] of Object.entries(metric.labels)) {
        const labelKeyFull = `${this.prefix}label:${labelKey}:${labelValue}`;
        await this.redis.sadd(labelKeyFull, metric.name);
      }
    }
  }

  async getMetrics(name: string, since?: Date): Promise<Metric[]> {
    const key = this.prefix + name;
    const minScore = since ? since.getTime() : 0;
    
    const results = await this.redis.zrangebyscore(key, minScore, "+inf");
    return results.map((r) => JSON.parse(r) as Metric);
  }

  async getMetricSummary(name: string, since?: Date): Promise<{
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  }> {
    const metrics = await this.getMetrics(name, since);
    
    if (metrics.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, sum: 0 };
    }

    const values = metrics.map((m) => m.value);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: metrics.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / metrics.length,
      sum,
    };
  }

  async incrementCounter(name: string, labels?: Record<string, string>): Promise<void> {
    const key = this.prefix + "counter:" + name;
    await this.redis.incr(key);
    
    if (labels) {
      const labelKey = `${key}:${JSON.stringify(labels)}`;
      await this.redis.incr(labelKey);
    }
  }

  async getCounter(name: string, labels?: Record<string, string>): Promise<number> {
    const key = labels 
      ? `${this.prefix}counter:${name}:${JSON.stringify(labels)}`
      : `${this.prefix}counter:${name}`;
    
    const value = await this.redis.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  async recordTiming(name: string, duration: number, labels?: Record<string, string>): Promise<void> {
    await this.recordMetric({
      name: `${name}_duration`,
      value: duration,
      timestamp: new Date(),
      labels,
    });
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
