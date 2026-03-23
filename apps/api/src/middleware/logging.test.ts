import { describe, test, expect } from "bun:test";

// Test the sanitization logic used in the logging middleware
function sanitizeRequestId(raw: string): string {
  const sanitized = raw.replace(/[^a-zA-Z0-9\-_.]/g, "").slice(0, 128);
  return sanitized || "";
}

describe("X-Request-ID sanitization", () => {
  test("allows valid alphanumeric IDs", () => {
    expect(sanitizeRequestId("abc-123-def")).toBe("abc-123-def");
    expect(sanitizeRequestId("req_456.test")).toBe("req_456.test");
  });

  test("strips newlines (prevents header injection)", () => {
    expect(sanitizeRequestId("valid\r\nX-Injected: true")).toBe("validX-Injectedtrue");
  });

  test("strips null bytes", () => {
    expect(sanitizeRequestId("valid\x00evil")).toBe("validevil");
  });

  test("strips spaces and special characters", () => {
    expect(sanitizeRequestId("hello world!@#$%")).toBe("helloworld");
  });

  test("truncates to 128 characters", () => {
    const long = "a".repeat(200);
    expect(sanitizeRequestId(long).length).toBe(128);
  });

  test("returns empty string for fully invalid input", () => {
    expect(sanitizeRequestId("!@#$%^&*()")).toBe("");
    expect(sanitizeRequestId("\r\n\r\n")).toBe("");
  });

  test("preserves dots, hyphens, and underscores", () => {
    expect(sanitizeRequestId("req-id_v2.0")).toBe("req-id_v2.0");
  });
});
