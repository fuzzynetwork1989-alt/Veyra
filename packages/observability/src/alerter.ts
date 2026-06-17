import Redis from "ioredis";
import { Alert, AlertSeverity } from "./types";
import { Logger } from "./logger";

export class Alerter {
  private redis: Redis;
  private prefix: string = "veyra:alerts:";
  private logger: Logger;

  constructor(redisUrl: string = process.env.REDIS_URL || "redis://localhost:6379") {
    this.redis = new Redis(redisUrl);
    this.logger = new Logger("alerter", redisUrl);
  }

  async createAlert(
    name: string,
    severity: AlertSeverity,
    condition: string,
    metadata?: Record<string, any>
  ): Promise<Alert> {
    const alert: Alert = {
      id: `alert-${Date.now()}`,
      name,
      severity,
      condition,
      triggeredAt: new Date(),
      metadata,
    };
    
    const key = this.prefix + alert.id;
    await this.redis.set(key, JSON.stringify(alert));
    await this.redis.sadd(`${this.prefix}active`, alert.id);
    
    this.logger.error(`Alert triggered: ${name}`, { alert });
    
    return alert;
  }

  async resolveAlert(alertId: string): Promise<void> {
    const key = this.prefix + alertId;
    const data = await this.redis.get(key);
    
    if (data) {
      const alert: Alert = JSON.parse(data);
      alert.resolvedAt = new Date();
      
      await this.redis.set(key, JSON.stringify(alert));
      await this.redis.srem(`${this.prefix}active`, alertId);
      
      this.logger.info(`Alert resolved: ${alert.name}`, { alert });
    }
  }

  async getActiveAlerts(): Promise<Alert[]> {
    const activeIds = await this.redis.smembers(`${this.prefix}active`);
    const alerts: Alert[] = [];
    
    for (const id of activeIds) {
      const data = await this.redis.get(this.prefix + id);
      if (data) {
        alerts.push(JSON.parse(data) as Alert);
      }
    }
    
    return alerts.sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime());
  }

  async getAlert(alertId: string): Promise<Alert | null> {
    const data = await this.redis.get(this.prefix + alertId);
    return data ? JSON.parse(data) as Alert : null;
  }

  async checkThreshold(
    metricName: string,
    threshold: number,
    operator: ">" | "<" | "=",
    alertName: string,
    severity: AlertSeverity
  ): Promise<boolean> {
    // This would check the actual metric value
    // For now, it's a placeholder
    return false;
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
    await this.logger.disconnect();
  }
}
