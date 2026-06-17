export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal",
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags?: Record<string, string>;
  logs?: LogEntry[];
}

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  condition: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export enum AlertSeverity {
  INFO = "info",
  WARNING = "warning",
  CRITICAL = "critical",
}
