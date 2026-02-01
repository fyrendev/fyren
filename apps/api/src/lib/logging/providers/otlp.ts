/**
 * OTLP Log Provider
 *
 * Ships logs using the OpenTelemetry Protocol (OTLP).
 * Features:
 * - Batching with configurable interval
 * - Custom headers support for authentication
 * - Fallback to console on shipping failure
 */

import type { LogEntry, ILogProvider, LoggerConfig, LogLevel } from "../types";
import { ConsoleLogProvider } from "./console";

// OTLP severity numbers (from OpenTelemetry spec)
const SEVERITY_NUMBER: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

const SEVERITY_TEXT: Record<LogLevel, string> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

interface OtlpLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: { key: string; value: { stringValue?: string; intValue?: string } }[];
  traceId?: string;
  spanId?: string;
}

interface OtlpScopeLog {
  scope: { name: string; version?: string };
  logRecords: OtlpLogRecord[];
}

interface OtlpResourceLog {
  resource: {
    attributes: { key: string; value: { stringValue: string } }[];
  };
  scopeLogs: OtlpScopeLog[];
}

interface OtlpLogsPayload {
  resourceLogs: OtlpResourceLog[];
}

const BATCH_INTERVAL_MS = 5000; // 5 seconds
const MAX_BATCH_SIZE = 100;

export class OtlpLogProvider implements ILogProvider {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackProvider: ConsoleLogProvider;
  private isShuttingDown = false;

  private otlpEndpoint: string;
  private otlpHeaders: Record<string, string>;
  private serviceName: string;

  constructor(config: LoggerConfig) {
    this.otlpEndpoint = config.otlpEndpoint!;
    this.otlpHeaders = config.otlpHeaders ?? {};
    this.serviceName = config.serviceName;
    this.fallbackProvider = new ConsoleLogProvider();

    // Start batch flush timer
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error("[OtlpProvider] Flush error:", err);
      });
    }, BATCH_INTERVAL_MS);
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);

    // Flush immediately if buffer is full
    if (this.buffer.length >= MAX_BATCH_SIZE) {
      this.flush().catch((err) => {
        console.error("[OtlpProvider] Flush error:", err);
      });
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    // Take current buffer and clear it
    const entries = this.buffer;
    this.buffer = [];

    try {
      await this.sendToOtlp(entries);
    } catch (error) {
      // Log to console as fallback
      console.error(
        "[OtlpProvider] Failed to send logs to OTLP endpoint, using console fallback:",
        error
      );
      for (const entry of entries) {
        this.fallbackProvider.log(entry);
      }
    }
  }

  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop the flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    await this.flush();
  }

  private async sendToOtlp(entries: LogEntry[]): Promise<void> {
    // Convert entries to OTLP log records
    const logRecords: OtlpLogRecord[] = entries.map((entry) => {
      const timestampNs = (new Date(entry.timestamp).getTime() * 1_000_000).toString();

      // Build attributes from context
      const attributes: OtlpLogRecord["attributes"] = [];

      if (entry.context) {
        for (const [key, value] of Object.entries(entry.context)) {
          if (value === undefined || value === null) continue;

          if (typeof value === "number") {
            attributes.push({
              key,
              value: { intValue: String(value) },
            });
          } else if (typeof value === "string") {
            attributes.push({
              key,
              value: { stringValue: value },
            });
          } else {
            // Convert complex types to JSON string
            attributes.push({
              key,
              value: { stringValue: JSON.stringify(value) },
            });
          }
        }
      }

      return {
        timeUnixNano: timestampNs,
        severityNumber: SEVERITY_NUMBER[entry.level],
        severityText: SEVERITY_TEXT[entry.level],
        body: { stringValue: entry.message },
        attributes,
      };
    });

    const payload: OtlpLogsPayload = {
      resourceLogs: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: this.serviceName } }],
          },
          scopeLogs: [
            {
              scope: { name: "fyren-api", version: "1.0.0" },
              logRecords,
            },
          ],
        },
      ],
    };

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.otlpHeaders,
    };

    // OTLP HTTP uses /v1/logs endpoint
    const logsUrl = `${this.otlpEndpoint.replace(/\/$/, "")}/v1/logs`;

    const response = await fetch(logsUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OTLP push failed: ${response.status} ${response.statusText} - ${body}`);
    }
  }
}
