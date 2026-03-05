import { describe, test, expect, beforeEach, mock } from "bun:test";

// We test the request module by importing it and checking behavior.
// Since getBaseUrl is private, we test it indirectly through the request function.

describe("request - getBaseUrl", () => {
  beforeEach(() => {
    // Reset env vars between tests
    delete process.env.INTERNAL_API_URL;
    delete process.env.NEXT_PUBLIC_INTERNAL_API_URL;
  });

  test("server-side: prefers INTERNAL_API_URL over NEXT_PUBLIC_INTERNAL_API_URL", async () => {
    process.env.INTERNAL_API_URL = "http://api:3001";
    process.env.NEXT_PUBLIC_INTERNAL_API_URL = "http://localhost:3001";

    // Re-import to get fresh module
    const mod = await import("./request.ts");

    const mockFetch = mock(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    globalThis.fetch = mockFetch as typeof fetch;

    await mod.request("/api/v1/status");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("http://api:3001/api/v1/status");
  });

  test("server-side: falls back to NEXT_PUBLIC_INTERNAL_API_URL when INTERNAL_API_URL is not set", async () => {
    process.env.NEXT_PUBLIC_INTERNAL_API_URL = "http://localhost:3001";

    const mod = await import("./request.ts");

    const mockFetch = mock(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    globalThis.fetch = mockFetch as typeof fetch;

    await mod.request("/api/v1/status");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("http://localhost:3001/api/v1/status");
  });

  test("server-side: returns empty string when no env vars are set", async () => {
    const mod = await import("./request.ts");

    const mockFetch = mock(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    globalThis.fetch = mockFetch as typeof fetch;

    await mod.request("/api/v1/status");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toBe("/api/v1/status");
  });
});
