import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { ConsoleLogProvider } from "./providers/console";
import { LokiLogProvider } from "./providers/loki";
import { OtlpLogProvider } from "./providers/otlp";
import type { LogEntry, LoggerConfig } from "./types";
import { LOG_LEVEL_PRIORITY } from "./types";

type MockFetch = ReturnType<typeof mock> & { mock: { calls: [string, RequestInit][] } };

describe("Logging Infrastructure", () => {
  describe("LOG_LEVEL_PRIORITY", () => {
    it("should have correct priority ordering", () => {
      expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info);
      expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn);
      expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error);
    });
  });

  describe("ConsoleLogProvider", () => {
    let provider: ConsoleLogProvider;
    let consoleSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      provider = new ConsoleLogProvider();
      consoleSpy = spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should log info messages to console.log", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test message",
        service: "test-service",
      };

      provider.log(entry);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.message).toBe("Test message");
      expect(output.level).toBe("info");
      expect(output.service).toBe("test-service");
    });

    it("should include context in log output", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test with context",
        service: "test-service",
        context: {
          requestId: "req-123",
          userId: "user-456",
        },
      };

      provider.log(entry);

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(output.requestId).toBe("req-123");
      expect(output.userId).toBe("user-456");
    });

    it("should use console.error for error level", () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});

      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "error",
        message: "Error message",
        service: "test-service",
      };

      provider.log(entry);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });

    it("should use console.warn for warn level", () => {
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "warn",
        message: "Warning message",
        service: "test-service",
      };

      provider.log(entry);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("should use console.debug for debug level", () => {
      const debugSpy = spyOn(console, "debug").mockImplementation(() => {});

      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "debug",
        message: "Debug message",
        service: "test-service",
      };

      provider.log(entry);

      expect(debugSpy).toHaveBeenCalledTimes(1);
      debugSpy.mockRestore();
    });

    it("flush should resolve immediately", async () => {
      await expect(provider.flush()).resolves.toBeUndefined();
    });

    it("shutdown should resolve immediately", async () => {
      await expect(provider.shutdown()).resolves.toBeUndefined();
    });
  });

  describe("LokiLogProvider", () => {
    let provider: LokiLogProvider;
    let fetchMock: MockFetch;

    const config: LoggerConfig = {
      provider: "loki",
      level: "info",
      serviceName: "test-service",
      lokiUrl: "http://localhost:3100",
      lokiUsername: "test-user",
      lokiPassword: "test-pass",
      lokiTenantId: "test-tenant",
    };

    beforeEach(() => {
      fetchMock = mock(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
        })
      ) as MockFetch;
      global.fetch = fetchMock as unknown as typeof fetch;
      provider = new LokiLogProvider(config);
    });

    afterEach(async () => {
      await provider.shutdown();
    });

    it("should buffer logs", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test message",
        service: "test-service",
      };

      provider.log(entry);
      provider.log(entry);

      // Logs are buffered, fetch should not be called yet
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should send logs to Loki on flush", async () => {
      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test message",
        service: "test-service",
        context: {
          organizationId: "org-123",
        },
      };

      provider.log(entry);
      await provider.flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const [url, options] = call!;
      expect(url).toBe("http://localhost:3100/loki/api/v1/push");
      expect(options.method).toBe("POST");
      const headers = options.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Scope-OrgID"]).toBe("test-tenant");
      expect(headers["Authorization"]).toContain("Basic");

      const body = JSON.parse(options.body as string);
      expect(body.streams).toHaveLength(1);
      expect(body.streams[0].stream.service).toBe("test-service");
      expect(body.streams[0].stream.level).toBe("info");
      expect(body.streams[0].stream.organization_id).toBe("org-123");
    });

    it("should fall back to console on fetch error", async () => {
      const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});

      fetchMock.mockImplementationOnce(() => Promise.reject(new Error("Network error")));

      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test message",
        service: "test-service",
      };

      provider.log(entry);
      await provider.flush();

      // Should have logged the error and fallen back to console
      expect(errorSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("should not flush if buffer is empty", async () => {
      await provider.flush();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should include worker name as label", async () => {
      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Worker message",
        service: "test-service",
        context: {
          workerName: "MonitorWorker",
        },
      };

      provider.log(entry);
      await provider.flush();

      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body as string);
      expect(body.streams[0].stream.worker).toBe("MonitorWorker");
    });
  });

  describe("OtlpLogProvider", () => {
    let provider: OtlpLogProvider;
    let fetchMock: MockFetch;

    const config: LoggerConfig = {
      provider: "otlp",
      level: "info",
      serviceName: "test-service",
      otlpEndpoint: "http://localhost:4318",
      otlpHeaders: { Authorization: "Bearer token123" },
    };

    beforeEach(() => {
      fetchMock = mock(() =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(""),
        })
      ) as MockFetch;
      global.fetch = fetchMock as unknown as typeof fetch;
      provider = new OtlpLogProvider(config);
    });

    afterEach(async () => {
      await provider.shutdown();
    });

    it("should buffer logs", () => {
      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test message",
        service: "test-service",
      };

      provider.log(entry);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("should send logs to OTLP endpoint on flush", async () => {
      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test message",
        service: "test-service",
        context: {
          requestId: "req-123",
          duration: 100,
        },
      };

      provider.log(entry);
      await provider.flush();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const [url, options] = call!;
      expect(url).toBe("http://localhost:4318/v1/logs");
      expect(options.method).toBe("POST");
      const headers = options.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["Authorization"]).toBe("Bearer token123");

      const body = JSON.parse(options.body as string);
      expect(body.resourceLogs).toHaveLength(1);
      expect(body.resourceLogs[0].resource.attributes).toContainEqual({
        key: "service.name",
        value: { stringValue: "test-service" },
      });

      const logRecord = body.resourceLogs[0].scopeLogs[0].logRecords[0];
      expect(logRecord.severityText).toBe("INFO");
      expect(logRecord.severityNumber).toBe(9);
      expect(logRecord.body.stringValue).toBe("Test message");

      // Check attributes
      const requestIdAttr = logRecord.attributes.find(
        (a: { key: string }) => a.key === "requestId"
      );
      expect(requestIdAttr.value.stringValue).toBe("req-123");

      const durationAttr = logRecord.attributes.find((a: { key: string }) => a.key === "duration");
      expect(durationAttr.value.intValue).toBe("100");
    });

    it("should fall back to console on fetch error", async () => {
      const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});

      fetchMock.mockImplementationOnce(() => Promise.reject(new Error("Network error")));

      const entry: LogEntry = {
        timestamp: "2024-01-01T00:00:00.000Z",
        level: "info",
        message: "Test message",
        service: "test-service",
      };

      provider.log(entry);
      await provider.flush();

      expect(errorSpy).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("should map log levels to OTLP severity", async () => {
      const levels = [
        { level: "debug" as const, severityNumber: 5, severityText: "DEBUG" },
        { level: "info" as const, severityNumber: 9, severityText: "INFO" },
        { level: "warn" as const, severityNumber: 13, severityText: "WARN" },
        { level: "error" as const, severityNumber: 17, severityText: "ERROR" },
      ];

      for (const { level } of levels) {
        const entry: LogEntry = {
          timestamp: "2024-01-01T00:00:00.000Z",
          level,
          message: `${level} message`,
          service: "test-service",
        };

        provider.log(entry);
      }

      await provider.flush();

      const call = fetchMock.mock.calls[0];
      expect(call).toBeDefined();
      const body = JSON.parse(call![1].body as string);
      const logRecords = body.resourceLogs[0].scopeLogs[0].logRecords;

      expect(logRecords[0].severityNumber).toBe(5);
      expect(logRecords[0].severityText).toBe("DEBUG");
      expect(logRecords[1].severityNumber).toBe(9);
      expect(logRecords[1].severityText).toBe("INFO");
      expect(logRecords[2].severityNumber).toBe(13);
      expect(logRecords[2].severityText).toBe("WARN");
      expect(logRecords[3].severityNumber).toBe(17);
      expect(logRecords[3].severityText).toBe("ERROR");
    });
  });
});
