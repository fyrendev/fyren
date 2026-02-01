/**
 * Loki Log Provider
 *
 * Ships logs to Grafana Loki using the Push API.
 * Features:
 * - Batching with configurable interval
 * - Basic auth and tenant ID support
 * - Fallback to console on shipping failure
 */

import type { LogEntry, ILogProvider, LoggerConfig } from "../types";
import { ConsoleLogProvider } from "./console";

interface LokiStream {
  stream: Record<string, string>;
  values: [string, string][];
}

interface LokiPushPayload {
  streams: LokiStream[];
}

const BATCH_INTERVAL_MS = 5000; // 5 seconds
const MAX_BATCH_SIZE = 100;

export class LokiLogProvider implements ILogProvider {
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackProvider: ConsoleLogProvider;
  private isShuttingDown = false;

  private lokiUrl: string;
  private lokiUsername?: string;
  private lokiPassword?: string;
  private lokiTenantId?: string;
  private serviceName: string;

  constructor(config: LoggerConfig) {
    this.lokiUrl = config.lokiUrl!;
    this.lokiUsername = config.lokiUsername;
    this.lokiPassword = config.lokiPassword;
    this.lokiTenantId = config.lokiTenantId;
    this.serviceName = config.serviceName;
    this.fallbackProvider = new ConsoleLogProvider();

    // Start batch flush timer
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error("[LokiProvider] Flush error:", err);
      });
    }, BATCH_INTERVAL_MS);
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);

    // Flush immediately if buffer is full
    if (this.buffer.length >= MAX_BATCH_SIZE) {
      this.flush().catch((err) => {
        console.error("[LokiProvider] Flush error:", err);
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
      await this.sendToLoki(entries);
    } catch (error) {
      // Log to console as fallback
      console.error("[LokiProvider] Failed to send logs to Loki, using console fallback:", error);
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

  private async sendToLoki(entries: LogEntry[]): Promise<void> {
    // Group entries by labels (level, service)
    const streamMap = new Map<string, LokiStream>();

    for (const entry of entries) {
      // Build static labels for the stream
      const labels: Record<string, string> = {
        service: entry.service,
        level: entry.level,
      };

      // Add organization as a label if present (common filtering dimension)
      if (entry.context?.organizationId) {
        labels.organization_id = String(entry.context.organizationId);
      }

      // Add worker name as a label if present
      if (entry.context?.workerName) {
        labels.worker = String(entry.context.workerName);
      }

      const labelKey = JSON.stringify(labels);

      if (!streamMap.has(labelKey)) {
        streamMap.set(labelKey, {
          stream: labels,
          values: [],
        });
      }

      // Loki expects nanosecond timestamps as strings
      const timestampNs = (new Date(entry.timestamp).getTime() * 1_000_000).toString();

      // Log line includes message and context as JSON
      const logLine = JSON.stringify({
        message: entry.message,
        ...entry.context,
      });

      streamMap.get(labelKey)!.values.push([timestampNs, logLine]);
    }

    const payload: LokiPushPayload = {
      streams: Array.from(streamMap.values()),
    };

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add basic auth if configured
    if (this.lokiUsername && this.lokiPassword) {
      const credentials = Buffer.from(`${this.lokiUsername}:${this.lokiPassword}`).toString(
        "base64"
      );
      headers["Authorization"] = `Basic ${credentials}`;
    }

    // Add tenant ID if configured (for multi-tenant Loki)
    if (this.lokiTenantId) {
      headers["X-Scope-OrgID"] = this.lokiTenantId;
    }

    const pushUrl = `${this.lokiUrl.replace(/\/$/, "")}/loki/api/v1/push`;

    const response = await fetch(pushUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Loki push failed: ${response.status} ${response.statusText} - ${body}`);
    }
  }
}
