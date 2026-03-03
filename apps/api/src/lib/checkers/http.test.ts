import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { checkHttp } from "./http";

describe("checkHttp", () => {
  const originalFetch = global.fetch;

  const createMockFetch = (response: Promise<Partial<Response>>) => {
    const mockFn = mock(() => response as Promise<Response>);
    // Add preconnect to satisfy the type
    (mockFn as unknown as { preconnect: () => void }).preconnect = () => {};
    return mockFn as unknown as typeof fetch;
  };

  beforeEach(() => {
    // Reset fetch mock before each test
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return up status on successful request with status 200", async () => {
    global.fetch = createMockFetch(
      Promise.resolve({
        status: 200,
        ok: true,
      })
    );

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("up");
    expect(result.statusCode).toBe(200);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.errorMessage).toBeUndefined();
  });

  it("should return up status when response matches expected status code", async () => {
    global.fetch = createMockFetch(
      Promise.resolve({
        status: 201,
        ok: true,
      })
    );

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
      expectedStatusCode: 201,
    });

    expect(result.status).toBe("up");
    expect(result.statusCode).toBe(201);
  });

  it("should default expectedStatusCode to 200", async () => {
    global.fetch = createMockFetch(
      Promise.resolve({
        status: 204,
        ok: true,
      })
    );

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
    });

    // Default expectedStatusCode is 200, so 204 should be considered down
    expect(result.status).toBe("down");
    expect(result.statusCode).toBe(204);
    expect(result.errorMessage).toBe("Expected status 200, got 204");
  });

  it("should return down status when status code does not match expected", async () => {
    global.fetch = createMockFetch(
      Promise.resolve({
        status: 404,
        ok: false,
      })
    );

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
      expectedStatusCode: 200,
    });

    expect(result.status).toBe("down");
    expect(result.statusCode).toBe(404);
    expect(result.errorMessage).toBe("Expected status 200, got 404");
  });

  it("should return down status for non-2xx when no expected status code is set", async () => {
    global.fetch = createMockFetch(
      Promise.resolve({
        status: 500,
        ok: false,
      })
    );

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.statusCode).toBe(500);
  });

  it("should return down status on timeout", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";

    global.fetch = createMockFetch(Promise.reject(abortError));

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 1000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Request timed out after 1000ms");
  });

  it("should return down status on network error", async () => {
    global.fetch = createMockFetch(Promise.reject(new Error("getaddrinfo ENOTFOUND example.com")));

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("getaddrinfo ENOTFOUND example.com");
  });

  it("should return down status on connection refused", async () => {
    global.fetch = createMockFetch(Promise.reject(new Error("connect ECONNREFUSED")));

    const result = await checkHttp({
      url: "https://localhost:9999",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("connect ECONNREFUSED");
  });

  it("should pass custom headers to fetch", async () => {
    const mockFetch = createMockFetch(
      Promise.resolve({
        status: 200,
        ok: true,
      })
    );
    global.fetch = mockFetch;

    await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
      headers: {
        Authorization: "Bearer token123",
        "X-Custom-Header": "value",
      },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer token123",
          "X-Custom-Header": "value",
        },
      })
    );
  });

  it("should handle unknown error types", async () => {
    global.fetch = createMockFetch(Promise.reject("string error"));

    const result = await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
    });

    expect(result.status).toBe("down");
    expect(result.errorMessage).toBe("Unknown error");
  });

  it("should use GET method", async () => {
    const mockFetch = createMockFetch(
      Promise.resolve({
        status: 200,
        ok: true,
      })
    );
    global.fetch = mockFetch;

    await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("should follow redirects", async () => {
    const mockFetch = createMockFetch(
      Promise.resolve({
        status: 200,
        ok: true,
      })
    );
    global.fetch = mockFetch;

    await checkHttp({
      url: "https://example.com",
      timeoutMs: 5000,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.objectContaining({
        redirect: "follow",
      })
    );
  });
});
