import { describe, it, expect, mock, beforeEach } from "bun:test";
import { parseHostPort } from "./tcp";

// Mock the net module
const mockSocketDestroy = mock(() => {});
const mockSocketSetTimeout = mock((_timeout: number) => {});

let connectCallback: (() => void) | null = null;
let errorCallback: ((err: Error) => void) | null = null;
let timeoutCallback: (() => void) | null = null;

const mockSocket = {
  on: mock((event: string, callback: () => void) => {
    if (event === "error") errorCallback = callback as (err: Error) => void;
    if (event === "timeout") timeoutCallback = callback;
    return mockSocket;
  }),
  destroy: mockSocketDestroy,
  setTimeout: mockSocketSetTimeout,
};

const mockConnect = mock((options: { host: string; port: number }, callback?: () => void) => {
  connectCallback = callback || null;
  return mockSocket;
});

mock.module("net", () => ({
  connect: mockConnect,
}));

// Import after mocking
const { checkTcp } = await import("./tcp");

describe("parseHostPort", () => {
  it("should parse host:port format", () => {
    const result = parseHostPort("localhost:8080");
    expect(result).toEqual({ host: "localhost", port: 8080 });
  });

  it("should parse tcp://host:port format", () => {
    const result = parseHostPort("tcp://localhost:8080");
    expect(result).toEqual({ host: "localhost", port: 8080 });
  });

  it("should handle custom ports", () => {
    const result = parseHostPort("myserver.com:3306");
    expect(result).toEqual({ host: "myserver.com", port: 3306 });
  });

  it("should return null for missing port", () => {
    const result = parseHostPort("localhost");
    expect(result).toBeNull();
  });

  it("should return null for empty host", () => {
    const result = parseHostPort(":8080");
    expect(result).toBeNull();
  });

  it("should return null for invalid port (non-numeric)", () => {
    const result = parseHostPort("localhost:abc");
    expect(result).toBeNull();
  });

  it("should return null for port out of range (0)", () => {
    const result = parseHostPort("localhost:0");
    expect(result).toBeNull();
  });

  it("should return null for port out of range (65536)", () => {
    const result = parseHostPort("localhost:65536");
    expect(result).toBeNull();
  });

  it("should return null for empty string", () => {
    const result = parseHostPort("");
    expect(result).toBeNull();
  });

  it("should return null for too many colons", () => {
    const result = parseHostPort("host:port:extra");
    expect(result).toBeNull();
  });
});

describe("checkTcp", () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockSocket.on.mockClear();
    mockSocketDestroy.mockClear();
    mockSocketSetTimeout.mockClear();
    connectCallback = null;
    errorCallback = null;
    timeoutCallback = null;
  });

  it("should return up status on successful connection", async () => {
    const resultPromise = checkTcp({
      host: "localhost",
      port: 8080,
      timeoutMs: 5000,
    });

    // Simulate successful connection
    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("up");
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.errorMessage).toBeUndefined();
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it("should pass correct options to connect", async () => {
    const resultPromise = checkTcp({
      host: "myserver.com",
      port: 3306,
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();
    await resultPromise;

    expect(mockConnect).toHaveBeenCalledWith(
      { host: "myserver.com", port: 3306 },
      expect.any(Function)
    );
  });

  it("should set socket timeout", async () => {
    const resultPromise = checkTcp({
      host: "localhost",
      port: 8080,
      timeoutMs: 3000,
    });

    if (connectCallback) connectCallback();
    await resultPromise;

    expect(mockSocketSetTimeout).toHaveBeenCalledWith(3000);
  });

  it("should return down status on connection error", async () => {
    const resultPromise = checkTcp({
      host: "localhost",
      port: 8080,
      timeoutMs: 5000,
    });

    // Simulate connection error
    if (errorCallback) errorCallback(new Error("connect ECONNREFUSED"));

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("connect ECONNREFUSED");
  });

  it("should return down status on socket timeout", async () => {
    const resultPromise = checkTcp({
      host: "localhost",
      port: 8080,
      timeoutMs: 2000,
    });

    // Simulate socket timeout event
    if (timeoutCallback) timeoutCallback();

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Connection timed out after 2000ms");
  });

  it("should destroy socket after successful connection", async () => {
    const resultPromise = checkTcp({
      host: "localhost",
      port: 8080,
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();
    await resultPromise;

    expect(mockSocketDestroy).toHaveBeenCalled();
  });

  it("should destroy socket after error", async () => {
    const resultPromise = checkTcp({
      host: "localhost",
      port: 8080,
      timeoutMs: 5000,
    });

    if (errorCallback) errorCallback(new Error("Connection refused"));
    await resultPromise;

    expect(mockSocketDestroy).toHaveBeenCalled();
  });

  it("should handle DNS resolution failure", async () => {
    const resultPromise = checkTcp({
      host: "nonexistent.invalid",
      port: 8080,
      timeoutMs: 5000,
    });

    if (errorCallback) errorCallback(new Error("getaddrinfo ENOTFOUND nonexistent.invalid"));

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("getaddrinfo ENOTFOUND nonexistent.invalid");
  });
});
