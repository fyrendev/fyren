import { describe, test, expect } from "bun:test";
import { Hono } from "hono";
import { widgetSecurityHeaders } from "./security";

// Use a mock resolver to avoid DB dependency in tests
const mockDefaultOrigins = () => widgetSecurityHeaders(async () => "*");
const mockCustomOrigins = (origins: string) => widgetSecurityHeaders(async () => origins);

describe("widgetSecurityHeaders", () => {
  test("does not include unsafe-inline in script-src", async () => {
    const app = new Hono();
    app.use("*", mockDefaultOrigins());
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy") ?? "";

    // script-src should be 'self' only, no unsafe-inline
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });

  test("allows unsafe-inline for style-src (expected for widgets)", async () => {
    const app = new Hono();
    app.use("*", mockDefaultOrigins());
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  test("defaults frame-ancestors to * when no org setting is configured", async () => {
    const app = new Hono();
    app.use("*", mockDefaultOrigins());
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("frame-ancestors *");
  });

  test("uses custom frame-ancestors from org settings", async () => {
    const app = new Hono();
    app.use("*", mockCustomOrigins("https://example.com https://other.com"));
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/");
    const csp = res.headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("frame-ancestors https://example.com https://other.com");
  });

  test("removes X-Frame-Options to allow embedding", async () => {
    const app = new Hono();
    app.use("*", mockDefaultOrigins());
    app.get("/", (c) => {
      c.header("X-Frame-Options", "DENY");
      return c.text("ok");
    });

    const res = await app.request("/");
    expect(res.headers.get("X-Frame-Options")).toBeNull();
  });

  test("sets X-Content-Type-Options: nosniff", async () => {
    const app = new Hono();
    app.use("*", mockDefaultOrigins());
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
