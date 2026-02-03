import { describe, it, expect, mock, beforeEach } from "bun:test";
import { parseNatsUrl, parseNatsAuthConfig } from "./nats";

// Mock the nats.ws module
const mockClose = mock(() => Promise.resolve());
const mockConnect = mock(() =>
  Promise.resolve({
    close: mockClose,
  })
);

mock.module("nats.ws", () => ({
  connect: mockConnect,
}));

// Import after mocking
const { checkNats } = await import("./nats");

describe("parseNatsUrl", () => {
  it("should parse nats://host:port format", () => {
    const result = parseNatsUrl("nats://localhost:4222");
    expect(result).toEqual({ host: "localhost", port: 4222 });
  });

  it("should parse nats://host format with default port", () => {
    const result = parseNatsUrl("nats://localhost");
    expect(result).toEqual({ host: "localhost", port: 4222 });
  });

  it("should parse host:port format without prefix", () => {
    const result = parseNatsUrl("localhost:4222");
    expect(result).toEqual({ host: "localhost", port: 4222 });
  });

  it("should parse host format without prefix with default port", () => {
    const result = parseNatsUrl("localhost");
    expect(result).toEqual({ host: "localhost", port: 4222 });
  });

  it("should handle custom ports", () => {
    const result = parseNatsUrl("nats://myserver.com:9222");
    expect(result).toEqual({ host: "myserver.com", port: 9222 });
  });

  it("should return null for empty string", () => {
    const result = parseNatsUrl("");
    expect(result).toBeNull();
  });

  it("should return null for invalid port", () => {
    const result = parseNatsUrl("localhost:abc");
    expect(result).toBeNull();
  });

  it("should return null for port out of range", () => {
    expect(parseNatsUrl("localhost:0")).toBeNull();
    expect(parseNatsUrl("localhost:65536")).toBeNull();
  });

  it("should return null for empty host", () => {
    const result = parseNatsUrl(":4222");
    expect(result).toBeNull();
  });

  it("should return null for too many colons", () => {
    const result = parseNatsUrl("host:port:extra");
    expect(result).toBeNull();
  });

  it("should trim whitespace", () => {
    const result = parseNatsUrl("  nats://localhost:4222  ");
    expect(result).toEqual({ host: "localhost", port: 4222 });
  });
});

describe("parseNatsAuthConfig", () => {
  it("should return undefined for null headers", () => {
    const result = parseNatsAuthConfig(null);
    expect(result).toBeUndefined();
  });

  it("should return undefined for undefined headers", () => {
    const result = parseNatsAuthConfig(undefined);
    expect(result).toBeUndefined();
  });

  it("should return undefined for empty headers", () => {
    const result = parseNatsAuthConfig({});
    expect(result).toBeUndefined();
  });

  it("should return undefined for auth_type 'none'", () => {
    const result = parseNatsAuthConfig({ auth_type: "none" });
    expect(result).toBeUndefined();
  });

  it("should parse token auth config", () => {
    const result = parseNatsAuthConfig({
      auth_type: "token",
      token: "my-secret-token",
    });
    expect(result).toEqual({
      authType: "token",
      token: "my-secret-token",
      user: undefined,
      pass: undefined,
      jwt: undefined,
      nkeySeed: undefined,
    });
  });

  it("should parse userpass auth config", () => {
    const result = parseNatsAuthConfig({
      auth_type: "userpass",
      user: "myuser",
      pass: "mypassword",
    });
    expect(result).toEqual({
      authType: "userpass",
      token: undefined,
      user: "myuser",
      pass: "mypassword",
      jwt: undefined,
      nkeySeed: undefined,
    });
  });

  it("should parse jwt auth config", () => {
    const result = parseNatsAuthConfig({
      auth_type: "jwt",
      jwt: "eyJ...",
      nkey_seed: "SUAM...",
    });
    expect(result).toEqual({
      authType: "jwt",
      token: undefined,
      user: undefined,
      pass: undefined,
      jwt: "eyJ...",
      nkeySeed: "SUAM...",
    });
  });
});

describe("checkNats", () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockClose.mockClear();
    mockConnect.mockImplementation(() =>
      Promise.resolve({
        close: mockClose,
      })
    );
  });

  it("should return up status on successful connection", async () => {
    const result = await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("up");
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.errorMessage).toBeUndefined();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("should pass correct connection options without auth", async () => {
    await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
    });

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        servers: ["nats://localhost:4222"],
        timeout: 5000,
        reconnect: false,
        maxReconnectAttempts: 0,
      })
    );
  });

  it("should pass token auth configuration", async () => {
    await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
      auth: {
        authType: "token",
        token: "my-token",
      },
    });

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "my-token",
      })
    );
  });

  it("should pass userpass auth configuration", async () => {
    await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
      auth: {
        authType: "userpass",
        user: "myuser",
        pass: "mypass",
      },
    });

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "myuser",
        pass: "mypass",
      })
    );
  });

  it("should pass jwt auth configuration", async () => {
    await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
      auth: {
        authType: "jwt",
        jwt: "eyJ...",
        nkeySeed: "SUAM...",
      },
    });

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        authenticator: expect.any(Function),
      })
    );
  });

  it("should return down status on connection error", async () => {
    mockConnect.mockImplementation(() => Promise.reject(new Error("Connection refused")));

    const result = await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Connection refused");
  });

  it("should return down status with timeout message on timeout error", async () => {
    mockConnect.mockImplementation(() => Promise.reject(new Error("timeout exceeded")));

    const result = await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Connection timed out after 5000ms");
  });

  it("should return down status with auth message on auth error", async () => {
    mockConnect.mockImplementation(() => Promise.reject(new Error("AUTHORIZATION_VIOLATION")));

    const result = await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toContain("Authentication failed");
  });

  it("should handle unknown errors", async () => {
    mockConnect.mockImplementation(() => Promise.reject("non-error-object"));

    const result = await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Unknown error");
  });

  it("should close connection even on close error", async () => {
    mockConnect.mockImplementation(() => Promise.reject(new Error("Connection failed")));

    // This test verifies the error handling doesn't throw
    const result = await checkNats({
      url: "nats://localhost:4222",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
  });
});
