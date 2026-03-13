import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { Job } from "bullmq";
import type { MonitorJobData } from "../../lib/queue";
import type { NotificationJobData } from "../../services/notification.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockCalls = any[][];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMock = ReturnType<typeof mock<(...args: any[]) => any>>;

// Mock logger
const mockWorkerError: AnyMock = mock(() => {});
const mockWorker: AnyMock = mock(() => {});
const mockInfo: AnyMock = mock(() => {});

const mockLogger = {
  worker: mockWorker,
  workerError: mockWorkerError,
  info: mockInfo,
  warn: mock(() => {}) as AnyMock,
  error: mock(() => {}) as AnyMock,
  debug: mock(() => {}) as AnyMock,
  flush: mock(() => Promise.resolve()),
  shutdown: mock(() => Promise.resolve()),
};

// Mock checkers
const mockExecuteCheck: AnyMock = mock(() =>
  Promise.resolve({
    status: "down" as "up" | "down",
    responseTimeMs: 1500,
    statusCode: 503,
    errorMessage: "Service Unavailable" as string | undefined,
  })
);

// Mock monitor service
const mockStoreCheckResult: AnyMock = mock(() => Promise.resolve());
const mockEvaluateComponentStatus: AnyMock = mock(() =>
  Promise.resolve({ shouldUpdateComponent: false, newStatus: "operational" })
);
const mockUpdateComponentStatus: AnyMock = mock(() => Promise.resolve());

// Mock email provider
const mockEmailSend: AnyMock = mock(() =>
  Promise.resolve({ success: false, error: "SMTP connection refused" })
);
const mockGetEmailProvider: AnyMock = mock(() => Promise.resolve({ send: mockEmailSend }));

// Mock email templates
const mockTemplate = {
  subject: "Test Subject",
  html: "<p>Test</p>",
  text: "Test",
};

// Mock webhook formatter
const mockFormatWebhook: AnyMock = mock(() => ({
  headers: {},
  body: { test: true },
}));

/**
 * Simulate the monitor worker processor logic (from monitor.worker.ts).
 * This avoids importing the real module which would trigger BullMQ Worker creation
 * and mock.module contamination of @fyrendev/db.
 */
async function simulateMonitorProcessor(job: Job<MonitorJobData>) {
  const { monitorId } = job.data;

  mockLogger.worker("MonitorWorker", `Processing check for monitor ${monitorId}`, {
    jobId: job.id,
    monitorId,
  });

  // Simulated monitor lookup
  const monitor = {
    id: monitorId,
    componentId: "comp-1",
    type: "http",
    url: "https://example.com",
    isActive: true,
  };

  const result = await mockExecuteCheck(monitor as never);
  mockLogger.worker(
    "MonitorWorker",
    `Check completed for ${monitorId}: ${result.status} (${result.responseTimeMs}ms)`,
    { jobId: job.id, monitorId, checkStatus: result.status, responseTimeMs: result.responseTimeMs }
  );

  // This is the new logging we added
  if (result.status === "down") {
    mockLogger.workerError("MonitorWorker", `Check failed for monitor ${monitorId}`, undefined, {
      jobId: job.id,
      monitorId,
      componentId: monitor.componentId,
      monitorUrl: monitor.url,
      monitorType: monitor.type,
      errorMessage: result.errorMessage,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
    });
  }

  await mockStoreCheckResult(monitorId, result);
  const evaluation = await mockEvaluateComponentStatus(monitorId, result);

  if (evaluation.shouldUpdateComponent) {
    await mockUpdateComponentStatus(monitor.componentId, evaluation.newStatus);
  }

  return { status: "completed", checkResult: result, evaluation };
}

/**
 * Simulate the notification worker email processor logic (from notification.worker.ts).
 */
async function simulateEmailProcessor(job: Job<NotificationJobData>) {
  const { email, unsubscribeToken, event, entityType, entityId } = job.data;

  if (!email || !unsubscribeToken) {
    mockLogger.workerError("NotificationWorker", "Missing email or unsubscribe token", undefined, {
      jobId: job.id,
      event,
      entityId,
    });
    throw new Error("Missing email or unsubscribe token");
  }

  // Simulate email generation + send
  const provider = await mockGetEmailProvider();
  const result = await provider.send({
    to: email,
    subject: mockTemplate.subject,
    html: mockTemplate.html,
    text: mockTemplate.text,
  });

  if (!result.success) {
    mockLogger.workerError("NotificationWorker", "Email send failed", undefined, {
      jobId: job.id,
      recipient: email,
      event,
      entityType,
      entityId,
      error: result.error,
    });
    throw new Error(result.error);
  }
}

/**
 * Simulate the notification worker webhook processor logic (from notification.worker.ts).
 */
async function simulateWebhookProcessor(job: Job<NotificationJobData>) {
  const { webhookId, webhookType, webhookUrl, webhookSecret, event, entityId } = job.data;

  if (!webhookId || !webhookType || !webhookUrl) {
    mockLogger.workerError("NotificationWorker", "Missing webhook details", undefined, {
      jobId: job.id,
      event,
      entityId,
    });
    throw new Error("Missing webhook details");
  }

  const formatted = mockFormatWebhook(webhookType, { event }, webhookSecret);

  let success = false;
  let error: string | undefined;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...formatted.headers },
      body: JSON.stringify(formatted.body),
    });

    if (!response.ok) {
      error = `HTTP ${response.status}: ${await response.text()}`;
      mockLogger.workerError("NotificationWorker", "Webhook HTTP error", undefined, {
        jobId: job.id,
        webhookId,
        webhookUrl,
        webhookType,
        event,
        httpStatus: response.status,
        error,
      });
    } else {
      success = true;
    }
  } catch (err) {
    error = (err as Error).message;
    mockLogger.workerError("NotificationWorker", "Webhook network error", undefined, {
      jobId: job.id,
      webhookId,
      webhookUrl,
      webhookType,
      event,
      error,
    });
  }

  if (!success) {
    throw new Error(error);
  }
}

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
      mockExecuteCheck.mockResolvedValueOnce({
        status: "down",
        responseTimeMs: 1500,
        statusCode: 503,
        errorMessage: "Service Unavailable",
      });

      const job = createMockJob<MonitorJobData>({ monitorId: "monitor-1" });
      await simulateMonitorProcessor(job);

      const failureCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "MonitorWorker" && (call[1] as string).includes("Check failed for monitor")
      );

      expect(failureCall).toBeDefined();
      expect(failureCall![0]).toBe("MonitorWorker");
      expect(failureCall![1]).toContain("Check failed for monitor monitor-1");
      expect(failureCall![2]).toBeUndefined();
      const context = failureCall![3] as Record<string, unknown>;
      expect(context.monitorId).toBe("monitor-1");
      expect(context.errorMessage).toBe("Service Unavailable");
      expect(context.statusCode).toBe(503);
      expect(context.responseTimeMs).toBe(1500);
    });

    it("should not log error when check result is up", async () => {
      mockExecuteCheck.mockResolvedValueOnce({
        status: "up",
        responseTimeMs: 200,
        statusCode: 200,
        errorMessage: undefined,
      });

      const job = createMockJob<MonitorJobData>({ monitorId: "monitor-1" });
      await simulateMonitorProcessor(job);

      const failureCall = (mockWorkerError.mock.calls as MockCalls).find(
        (call) =>
          call[0] === "MonitorWorker" && (call[1] as string).includes("Check failed for monitor")
      );

      expect(failureCall).toBeUndefined();
    });
  });

  describe("NotificationWorker - Email", () => {
    it("should log error when email send fails", async () => {
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

      await expect(simulateEmailProcessor(job)).rejects.toThrow("SMTP connection refused");

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
      const job = createMockJob<NotificationJobData>(
        {
          type: "email",
          email: undefined,
          unsubscribeToken: undefined,
          organizationName: "Test Org",
          event: "incident.created" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-1",
          data: {},
        },
        "email-job-2",
        "email-notification"
      );

      await expect(simulateEmailProcessor(job)).rejects.toThrow(
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
          event: "incident.created" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-1",
          data: { title: "Test" },
        },
        "webhook-job-1",
        "webhook-notification"
      );

      await expect(simulateWebhookProcessor(job)).rejects.toThrow();

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
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("ECONNREFUSED"))
      ) as unknown as typeof fetch;

      const job = createMockJob<NotificationJobData>(
        {
          type: "webhook",
          webhookId: "wh-2",
          webhookType: "slack" as NotificationJobData["webhookType"],
          webhookUrl: "https://hooks.example.com/test",
          organizationName: "Test Org",
          event: "incident.resolved" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-2",
          data: { title: "Test" },
        },
        "webhook-job-2",
        "webhook-notification"
      );

      await expect(simulateWebhookProcessor(job)).rejects.toThrow();

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
      const job = createMockJob<NotificationJobData>(
        {
          type: "webhook",
          webhookId: undefined,
          webhookType: undefined,
          webhookUrl: undefined,
          organizationName: "Test Org",
          event: "incident.created" as NotificationJobData["event"],
          entityType: "incident",
          entityId: "inc-3",
          data: {},
        },
        "webhook-job-3",
        "webhook-notification"
      );

      await expect(simulateWebhookProcessor(job)).rejects.toThrow("Missing webhook details");

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
