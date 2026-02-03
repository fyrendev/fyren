import { describe, it, expect, mock, beforeEach } from "bun:test";
import { parseHost } from "./ssl";

// Mock the tls module
let connectCallback: (() => void) | null = null;
let errorCallback: ((err: Error) => void) | null = null;
let timeoutCallback: (() => void) | null = null;
let mockCertificate: { valid_to?: string; issuer?: Record<string, string> } | null = null;

const mockSocketDestroy = mock(() => {});
const mockSocketSetTimeout = mock((_timeout: number) => {});
const mockGetPeerCertificate = mock(() => mockCertificate);

const mockSocket = {
  on: mock((event: string, callback: () => void) => {
    if (event === "error") errorCallback = callback as (err: Error) => void;
    if (event === "timeout") timeoutCallback = callback;
    return mockSocket;
  }),
  destroy: mockSocketDestroy,
  setTimeout: mockSocketSetTimeout,
  getPeerCertificate: mockGetPeerCertificate,
};

const mockConnect = mock(
  (
    options: { host: string; port: number; servername: string; rejectUnauthorized: boolean },
    callback?: () => void
  ) => {
    connectCallback = callback || null;
    return mockSocket;
  }
);

mock.module("tls", () => ({
  connect: mockConnect,
}));

// Import after mocking
const { checkSsl } = await import("./ssl");

describe("parseHost", () => {
  it("should parse plain host", () => {
    const result = parseHost("example.com");
    expect(result).toEqual({ host: "example.com" });
  });

  it("should parse host:port", () => {
    const result = parseHost("example.com:8443");
    expect(result).toEqual({ host: "example.com", port: 8443 });
  });

  it("should parse https://host", () => {
    const result = parseHost("https://example.com");
    expect(result).toEqual({ host: "example.com" });
  });

  it("should parse https://host:port", () => {
    const result = parseHost("https://example.com:8443");
    expect(result).toEqual({ host: "example.com", port: 8443 });
  });

  it("should parse http://host (strip protocol)", () => {
    const result = parseHost("http://example.com");
    expect(result).toEqual({ host: "example.com" });
  });

  it("should strip path from URL", () => {
    const result = parseHost("https://example.com/path/to/resource");
    expect(result).toEqual({ host: "example.com" });
  });

  it("should strip path from URL with port", () => {
    const result = parseHost("https://example.com:8443/path");
    expect(result).toEqual({ host: "example.com", port: 8443 });
  });

  it("should return null for invalid port (non-numeric)", () => {
    const result = parseHost("example.com:abc");
    expect(result).toBeNull();
  });

  it("should return null for port out of range (0)", () => {
    const result = parseHost("example.com:0");
    expect(result).toBeNull();
  });

  it("should return null for port out of range (65536)", () => {
    const result = parseHost("example.com:65536");
    expect(result).toBeNull();
  });

  it("should return null for empty string", () => {
    const result = parseHost("");
    expect(result).toBeNull();
  });
});

describe("checkSsl", () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockSocket.on.mockClear();
    mockSocketDestroy.mockClear();
    mockSocketSetTimeout.mockClear();
    mockGetPeerCertificate.mockClear();
    connectCallback = null;
    errorCallback = null;
    timeoutCallback = null;
    mockCertificate = null;
  });

  it("should return up status for valid certificate with good expiry", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90); // 90 days from now

    mockCertificate = {
      valid_to: futureDate.toISOString(),
      issuer: { CN: "Test CA", O: "Test Org" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("up");
    expect(result.daysUntilExpiry).toBeGreaterThan(14);
    expect(result.expiresAt).toBeDefined();
    expect(result.issuer).toContain("CN=Test CA");
  });

  it("should return down status for certificate expiring within warning days", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    mockCertificate = {
      valid_to: futureDate.toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
      warningDays: 14,
    });

    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.daysUntilExpiry).toBeLessThan(14);
    expect(result.errorMessage).toContain("expires in");
    expect(result.errorMessage).toContain("warning threshold: 14 days");
  });

  it("should return down status for expired certificate", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 30); // 30 days ago

    mockCertificate = {
      valid_to: pastDate.toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.daysUntilExpiry).toBeLessThan(0);
    expect(result.errorMessage).toContain("expired");
  });

  it("should use custom warning days threshold", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 25); // 25 days from now

    mockCertificate = {
      valid_to: futureDate.toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
      warningDays: 30, // Custom warning threshold
    });

    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toContain("warning threshold: 30 days");
  });

  it("should return up status when expiry is just above warning threshold", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 15); // 15 days from now

    mockCertificate = {
      valid_to: futureDate.toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
      warningDays: 14, // Default warning threshold
    });

    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("up");
    expect(result.daysUntilExpiry).toBeGreaterThanOrEqual(14);
  });

  it("should use default port 443", async () => {
    mockCertificate = {
      valid_to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();
    await resultPromise;

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "example.com",
        port: 443,
      }),
      expect.any(Function)
    );
  });

  it("should use custom port when specified", async () => {
    mockCertificate = {
      valid_to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      port: 8443,
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();
    await resultPromise;

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "example.com",
        port: 8443,
      }),
      expect.any(Function)
    );
  });

  it("should set SNI servername", async () => {
    mockCertificate = {
      valid_to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();
    await resultPromise;

    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({
        servername: "example.com",
      }),
      expect.any(Function)
    );
  });

  it("should return down status on connection error", async () => {
    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (errorCallback) errorCallback(new Error("connect ECONNREFUSED"));

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("connect ECONNREFUSED");
  });

  it("should return down status on socket timeout", async () => {
    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 2000,
    });

    if (timeoutCallback) timeoutCallback();

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Connection timed out after 2000ms");
  });

  it("should return down status when certificate info is missing", async () => {
    mockCertificate = null;

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Could not retrieve certificate information");
  });

  it("should return down status when valid_to is missing", async () => {
    mockCertificate = {
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Could not retrieve certificate information");
  });

  it("should handle DNS resolution failure", async () => {
    const resultPromise = checkSsl({
      host: "nonexistent.invalid",
      timeoutMs: 5000,
    });

    if (errorCallback) errorCallback(new Error("getaddrinfo ENOTFOUND nonexistent.invalid"));

    const result = await resultPromise;

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("getaddrinfo ENOTFOUND nonexistent.invalid");
  });

  it("should destroy socket after successful check", async () => {
    mockCertificate = {
      valid_to: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      issuer: { CN: "Test CA" },
    };

    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (connectCallback) connectCallback();
    await resultPromise;

    expect(mockSocketDestroy).toHaveBeenCalled();
  });

  it("should destroy socket after error", async () => {
    const resultPromise = checkSsl({
      host: "example.com",
      timeoutMs: 5000,
    });

    if (errorCallback) errorCallback(new Error("Connection refused"));
    await resultPromise;

    expect(mockSocketDestroy).toHaveBeenCalled();
  });
});
