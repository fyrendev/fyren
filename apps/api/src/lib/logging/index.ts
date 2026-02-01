/**
 * Fyren Logging Infrastructure
 *
 * Provides structured logging with support for multiple providers:
 * - Console (default): JSON output to stdout
 * - Loki: Push logs to Grafana Loki
 * - OTLP: OpenTelemetry protocol for various backends
 */

import type { LogLevel, LogContext, LogEntry, ILogProvider, LoggerConfig } from "./types";
import { LOG_LEVEL_PRIORITY } from "./types";
import { ConsoleLogProvider } from "./providers/console";
import { LokiLogProvider } from "./providers/loki";
import { OtlpLogProvider } from "./providers/otlp";

let globalProvider: ILogProvider | null = null;
let globalConfig: LoggerConfig | null = null;

/**
 * Initialize the logging system with configuration
 */
export function initializeLogger(config: LoggerConfig): void {
  globalConfig = config;

  switch (config.provider) {
    case "loki":
      if (!config.lokiUrl) {
        console.warn("[Logger] LOKI_URL not set, falling back to console provider");
        globalProvider = new ConsoleLogProvider();
      } else {
        globalProvider = new LokiLogProvider(config);
      }
      break;
    case "otlp":
      if (!config.otlpEndpoint) {
        console.warn("[Logger] OTLP_ENDPOINT not set, falling back to console provider");
        globalProvider = new ConsoleLogProvider();
      } else {
        globalProvider = new OtlpLogProvider(config);
      }
      break;
    case "console":
    default:
      globalProvider = new ConsoleLogProvider();
      break;
  }
}

/**
 * Get the current log provider (initializes with console if not set)
 */
function getProvider(): ILogProvider {
  if (!globalProvider) {
    globalProvider = new ConsoleLogProvider();
  }
  return globalProvider;
}

/**
 * Get the current service name
 */
function getServiceName(): string {
  return globalConfig?.serviceName ?? "fyren-api";
}

/**
 * Check if a log level should be logged based on configuration
 */
function shouldLog(level: LogLevel): boolean {
  const configuredLevel = globalConfig?.level ?? "info";
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[configuredLevel];
}

/**
 * Create a log entry
 */
function createEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: getServiceName(),
    context,
  };
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry = createEntry(level, message, context);
  getProvider().log(entry);
}

/**
 * Logger interface for application use
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    log("debug", message, context);
  },

  info(message: string, context?: LogContext): void {
    log("info", message, context);
  },

  warn(message: string, context?: LogContext): void {
    log("warn", message, context);
  },

  error(message: string, context?: LogContext): void {
    log("error", message, context);
  },

  /**
   * Log an HTTP request
   */
  http(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
    log(level, `${method} ${path} ${statusCode} ${duration}ms`, {
      ...context,
      method,
      path,
      statusCode,
      duration,
    });
  },

  /**
   * Log a worker event
   */
  worker(
    workerName: string,
    message: string,
    context?: LogContext & { jobId?: string; jobName?: string }
  ): void {
    log("info", `[${workerName}] ${message}`, {
      ...context,
      workerName,
    });
  },

  /**
   * Log a worker error
   */
  workerError(
    workerName: string,
    message: string,
    error?: Error,
    context?: LogContext & { jobId?: string; jobName?: string }
  ): void {
    log("error", `[${workerName}] ${message}`, {
      ...context,
      workerName,
      errorName: error?.name,
      errorCode:
        error instanceof Error && "code" in error
          ? (error as Error & { code?: string }).code
          : undefined,
      stack: error?.stack,
    });
  },

  /**
   * Log an audit event
   */
  audit(
    action: string,
    entityType: string,
    entityId: string,
    context?: LogContext & {
      userId?: string;
      organizationId?: string;
      changes?: Record<string, unknown>;
    }
  ): void {
    log("info", `AUDIT: ${action} ${entityType}:${entityId}`, {
      ...context,
      action,
      entityType,
      entityId,
    });
  },

  /**
   * Flush buffered logs
   */
  async flush(): Promise<void> {
    await getProvider().flush();
  },

  /**
   * Gracefully shutdown the logger
   */
  async shutdown(): Promise<void> {
    await getProvider().shutdown();
  },
};

// Re-export types
export type { LogLevel, LogContext, LogEntry, ILogProvider, LoggerConfig } from "./types";
