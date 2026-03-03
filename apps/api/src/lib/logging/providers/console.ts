/**
 * Console Log Provider
 *
 * Outputs structured JSON logs to stdout.
 * This is the default provider and also serves as a fallback.
 */

import type { LogEntry, ILogProvider } from "../types";

export class ConsoleLogProvider implements ILogProvider {
  log(entry: LogEntry): void {
    // Format as structured JSON for easy parsing by log aggregators
    const output = {
      timestamp: entry.timestamp,
      level: entry.level,
      message: entry.message,
      service: entry.service,
      ...entry.context,
    };

    // Use appropriate console method based on level
    switch (entry.level) {
      case "debug":
        console.debug(JSON.stringify(output));
        break;
      case "warn":
        console.warn(JSON.stringify(output));
        break;
      case "error":
        console.error(JSON.stringify(output));
        break;
      case "info":
      default:
        console.log(JSON.stringify(output));
        break;
    }
  }

  async flush(): Promise<void> {
    // Console provider has no buffering, nothing to flush
  }

  async shutdown(): Promise<void> {
    // Console provider needs no cleanup
  }
}
