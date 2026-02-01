/**
 * Logging type definitions for Fyren API
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export type LogProvider = "console" | "loki" | "otlp";

/**
 * Context that can be attached to log entries
 */
export interface LogContext {
  // Request context
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  userAgent?: string;
  ip?: string;

  // User context
  userId?: string;
  organizationId?: string;

  // Worker context
  workerName?: string;
  jobId?: string;
  jobName?: string;

  // Error context
  errorName?: string;
  errorCode?: string;
  stack?: string;

  // Audit context
  action?: string;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, unknown>;

  // Generic metadata
  [key: string]: unknown;
}

/**
 * A structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context?: LogContext;
}

/**
 * Interface for log providers
 */
export interface ILogProvider {
  /**
   * Log a single entry
   */
  log(entry: LogEntry): void;

  /**
   * Flush any buffered logs (for batching providers)
   */
  flush(): Promise<void>;

  /**
   * Gracefully shutdown the provider
   */
  shutdown(): Promise<void>;
}

/**
 * Logger configuration from environment
 */
export interface LoggerConfig {
  provider: LogProvider;
  level: LogLevel;
  serviceName: string;

  // Loki-specific
  lokiUrl?: string;
  lokiUsername?: string;
  lokiPassword?: string;
  lokiTenantId?: string;

  // OTLP-specific
  otlpEndpoint?: string;
  otlpHeaders?: Record<string, string>;
}
