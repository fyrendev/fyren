import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { Job } from "bullmq";
import type { MonitorJobData } from "../../lib/queue";
import type { NotificationJobData } from "../../services/notification.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockCalls = any[][];

// Mock logger before importing workers
const mockWorkerError = mock(() => {});
const mockWorker = mock(() => {});
const mockInfo = mock(() => {});

mock.module("../../lib/logging", () => ({
  logger: {
    worker: mockWorker,
    workerError: mockWorkerError,
    info: mockInfo,
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
    flush: mock(() => Promise.resolve()),
    shutdown: mock(() => Promise.resolve()),
  },
  initializeLogger: mock(() => {}),
  loadConfigFromEnv: mock(() => ({
    provider: "console",
    level: "info",
    serviceName: "test",
  })),
}));

// Mock Redis
mock.module("../../lib/redis", () => ({
  bullmqRedis: {
    ping: mock(() => Promise.resolve()),
    quit: mock(() => Promise.resolve()),
    duplicate: mock(() => ({
      ping: mock(() => Promise.resolve()),
      quit: mock(() => Promise.resolve()),
    })),
  },
  redis: {
    quit: mock(() => Promise.resolve()),
  },
}));

// Mock database
const mockDbSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      limit: mock(() =>
        Promise.resolve([
          {
            id: "monitor-1",
            componentId: "comp-1",
            type: "http",
            url: "https://example.com",
            intervalSeconds: 60,
            timeoutMs: 5000,
            expectedStatusCode: 200,
            headers: null,
            failureThreshold: 3,
            isActive: true,
          },
        ])
      ),
    })),
  })),
}));

const mockDbInsert = mock(() => ({
  values: mock(() => Promise.resolve()),
}));

const mockDbUpdate = mock(() => ({
  set: mock(() => ({
    where: mock(() => Promise.resolve()),
  })),
}));

mock.module("@fyrendev/db", () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
  monitors: { id: "id", isActive: "is_active" },
  notificationLogs: {},
  webhookEndpoints: { id: "id", consecutiveFailures: "consecutive_failures" },
  eq: mock((a: unknown, b: unknown) => ({ a, b })),
  sql: mock((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

// Mock checkers
const mockExecuteCheck = mock(() =>
  Promise.resolve({
    status: "down" as "up" | "down",
    responseTimeMs: 1500,
    statusCode: 503,
    errorMessage: "Service Unavailable" as string | undefined,
  })
);

mock.module("../../lib/checkers", () => ({
  executeCheck: mockExecuteCheck,
}));

// Mock monitor service
mock.module("../../services/monitor.service", () => ({
  storeCheckResult: mock(() => Promise.resolve()),
  evaluateComponentStatus: mock(() =>
    Promise.resolve({ shouldUpdateComponent: false, newStatus: "operational" })
  ),
  updateComponentStatus: mock(() => Promise.resolve()),
}));

// Mock email provider
const mockEmailSend = mock(() =>
  Promise.resolve({ success: false, error: "SMTP connection refused" })
);

mock.module("../../lib/email", () => ({
  getEmailProvider: mock(() =>
    Promise.resolve({
      send: mockEmailSend,
    })
  ),
}));

// Mock email templates
const mockTemplate = {
  subject: "Test Subject",
  html: "<p>Test</p>",
  text: "Test",
};

mock.module("../../lib/email/templates/incident", () => ({
  incidentCreatedTemplate: mock(() => mockTemplate),
  incidentUpdatedTemplate: mock(() => mockTemplate),
  incidentResolvedTemplate: mock(() => mockTemplate),
}));

mock.module("../../lib/email/templates/maintenance", () => ({
  maintenanceScheduledTemplate: mock(() => mockTemplate),
  maintenanceStartedTemplate: mock(() => mockTemplate),
  maintenanceCompletedTemplate: mock(() => mockTemplate),
}));

// Mock webhook formatter
mock.module("../../lib/webhooks", () => ({
  formatWebhook: mock(() => ({
    headers: {},
    body: { test: true },
  })),
}));

// Mock worker env
mock.module("../../env/worker", () => ({
  env: {
    APP_URL: "http://localhost:3000",
  },
}));

// Mock BullMQ Worker to capture processor functions
let capturedMonitorProcessor: ((job: Job<MonitorJobData>) => Promise<unknown>) | null = null;
let capturedNotificationProcessor: ((job: Job<NotificationJobData>) => Promise<unknown>) | null =
  null;

mock.module("bullmq", () => ({
  Worker: class MockWorker {
    name: string;
    processor: (job: Job) => Promise<unknown>;

    constructor(name: string, processor: (job: Job) => Promise<unknown>) {
      this.name = name;
      this.processor = processor;
      if (name === "monitor-checks") {
        capturedMonitorProcessor = processor as (job: Job<MonitorJobData>) => Promise<unknown>;
      } else if (name === "notifications") {
        capturedNotificationProcessor = processor as (
          job: Job<NotificationJobData>
        ) => Promise<unknown>;
      }
    }

    on() {
      return this;
    }

    async close() {}
  },
  Queue: class MockQueue {
    constructor() {}
    async close() {}
  },
}));

// Now import the workers (after mocks are set up)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../monitor.worker");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../notification.worker");

function createMockJob<T>(data: T, id = "job-1", name = "test-job"): Job<T> {
  return { id, name, data } as unknown as Job<T>;
}

describe("Worker Logging", () => {
  beforeEach(() => {
    mockWorkerError.mockClear();
    mockWorker.mockClear();
    mockInfo.mockClear();
  });

  describe("MonitorWorker", () => {
    it("should log at error level when check result is down", async () => {
      expect(capturedMonitorProcessor).not.toBeNull();

      mockExecuteCheck.mockResolvedValueOnce({
        status: "down",
        responseTimeMs: 1500,
        statusCode: 503,
        errorMessage: "Service Unavailable",
      });

      const job = createMockJob<MonitorJobData>({ monitorId: "monitor-1" });

      await capturedMonitorProcessor!(job);

      // Find the call that matches check failure logging
      const failureCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "MonitorWorker" && (call[1] as string).includes("Check failed for monitor")
      );

      expect(failureCall).toBeDefined();
      expect(failureCall![0]).toBe("MonitorWorker");
      expect(failureCall![1]).toContain("Check failed for monitor monitor-1");
      // 3rd arg is undefined (no Error object)
      expect(failureCall![2]).toBeUndefined();
      // 4th arg is the context
      const context = failureCall![3] as Record<string, unknown>;
      expect(context.monitorId).toBe("monitor-1");
      expect(context.errorMessage).toBe("Service Unavailable");
      expect(context.statusCode).toBe(503);
      expect(context.responseTimeMs).toBe(1500);
    });

    it("should not log error when check result is up", async () => {
      expect(capturedMonitorProcessor).not.toBeNull();

      mockExecuteCheck.mockResolvedValueOnce({
        status: "up",
        responseTimeMs: 200,
        statusCode: 200,
        errorMessage: undefined,
      });

      const job = createMockJob<MonitorJobData>({ monitorId: "monitor-1" });

      await capturedMonitorProcessor!(job);

      const failureCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "MonitorWorker" && (call[1] as string).includes("Check failed for monitor")
      );

      expect(failureCall).toBeUndefined();
    });
  });

  describe("NotificationWorker - Email", () => {
    it("should log error when email send fails", async () => {
      expect(capturedNotificationProcessor).not.toBeNull();

      mockEmailSend.mockResolvedValueOnce({
        success: false,
        error: "SMTP connection refused",
      });

      const job = createMockJob<NotificationJobData>(
        {
          type: "email",
          email: "test@example.com",
          unsubscribeToken: "token-123",
          organizationName: "Test Org",
          organizationSlug: "test-org",
          event: "incident.created" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-1",
          data: {
            title: "Test Incident",
            status: "investigating",
            severity: "major",
            message: "Something broke",
            affectedComponents: [],
          },
        },
        "email-job-1",
        "email-notification"
      );

      await expect(capturedNotificationProcessor!(job)).rejects.toThrow("SMTP connection refused");

      const emailFailCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "NotificationWorker" && (call[1] as string).includes("Email send failed")
      );

      expect(emailFailCall).toBeDefined();
      const context = emailFailCall![3] as Record<string, unknown>;
      expect(context.recipient).toBe("test@example.com");
      expect(context.event).toBe("incident.created");
      expect(context.entityId).toBe("inc-1");
      expect(context.error).toBe("SMTP connection refused");
    });

    it("should log error when email validation fails", async () => {
      expect(capturedNotificationProcessor).not.toBeNull();

      const job = createMockJob<NotificationJobData>(
        {
          type: "email",
          email: undefined,
          unsubscribeToken: undefined,
          organizationName: "Test Org",
          organizationSlug: "test-org",
          event: "incident.created" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-1",
          data: {},
        },
        "email-job-2",
        "email-notification"
      );

      await expect(capturedNotificationProcessor!(job)).rejects.toThrow(
        "Missing email or unsubscribe token"
      );

      const validationCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "NotificationWorker" &&
          (call[1] as string).includes("Missing email or unsubscribe token")
      );

      expect(validationCall).toBeDefined();
      const context = validationCall![3] as Record<string, unknown>;
      expect(context.jobId).toBe("email-job-2");
      expect(context.entityId).toBe("inc-1");
    });
  });

  describe("NotificationWorker - Webhook", () => {
    it("should log error on webhook HTTP failure", async () => {
      expect(capturedNotificationProcessor).not.toBeNull();

      // Mock fetch to return non-ok response
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error"),
        })
      ) as unknown as typeof fetch;

      const job = createMockJob<NotificationJobData>(
        {
          type: "webhook",
          webhookId: "wh-1",
          webhookType: "generic" as NotificationJobData["webhookType"],
          webhookUrl: "https://hooks.example.com/webhook",
          organizationName: "Test Org",
          organizationSlug: "test-org",
          event: "incident.created" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-1",
          data: { title: "Test" },
        },
        "webhook-job-1",
        "webhook-notification"
      );

      await expect(capturedNotificationProcessor!(job)).rejects.toThrow();

      const httpErrorCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "NotificationWorker" && (call[1] as string).includes("Webhook HTTP error")
      );

      expect(httpErrorCall).toBeDefined();
      const context = httpErrorCall![3] as Record<string, unknown>;
      expect(context.webhookId).toBe("wh-1");
      expect(context.webhookUrl).toBe("https://hooks.example.com/webhook");
      expect(context.httpStatus).toBe(500);

      globalThis.fetch = originalFetch;
    });

    it("should log error on webhook network failure", async () => {
      expect(capturedNotificationProcessor).not.toBeNull();

      // Mock fetch to throw network error
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("ECONNREFUSED"))
      ) as unknown as typeof fetch;

      const job = createMockJob<NotificationJobData>(
        {
          type: "webhook",
          webhookId: "wh-2",
          webhookType: "slack" as NotificationJobData["webhookType"],
          webhookUrl: "https://hooks.slack.com/test",
          organizationName: "Test Org",
          organizationSlug: "test-org",
          event: "incident.resolved" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-2",
          data: { title: "Test" },
        },
        "webhook-job-2",
        "webhook-notification"
      );

      await expect(capturedNotificationProcessor!(job)).rejects.toThrow();

      const networkErrorCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "NotificationWorker" && (call[1] as string).includes("Webhook network error")
      );

      expect(networkErrorCall).toBeDefined();
      const context = networkErrorCall![3] as Record<string, unknown>;
      expect(context.webhookId).toBe("wh-2");
      expect(context.error).toBe("ECONNREFUSED");

      globalThis.fetch = originalFetch;
    });

    it("should log error when webhook validation fails", async () => {
      expect(capturedNotificationProcessor).not.toBeNull();

      const job = createMockJob<NotificationJobData>(
        {
          type: "webhook",
          webhookId: undefined,
          webhookType: undefined,
          webhookUrl: undefined,
          organizationName: "Test Org",
          organizationSlug: "test-org",
          event: "incident.created" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-3",
          data: {},
        },
        "webhook-job-3",
        "webhook-notification"
      );

      await expect(capturedNotificationProcessor!(job)).rejects.toThrow("Missing webhook details");

      const validationCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "NotificationWorker" &&
          (call[1] as string).includes("Missing webhook details")
      );

      expect(validationCall).toBeDefined();
      const context = validationCall![3] as Record<string, unknown>;
      expect(context.jobId).toBe("webhook-job-3");
    });
  });
});
