import { Hono } from "hono";
import { cors } from "hono/cors";
import { contextStorage } from "hono/context-storage";
import { errorResponse } from "../lib/errors";
import { setupRoutes } from "../routes";

/**
 * Create a fresh Hono app instance for testing.
 * This mirrors the production app setup without starting a server.
 */
export function createTestApp() {
  const app = new Hono();

  // Context storage (AsyncLocalStorage) — must be first middleware
  // Required for MCP tool handlers to access Hono context variables
  app.use("*", contextStorage());

  // Skip logger in tests to reduce noise
  // app.use("*", logger());

  // CORS middleware
  app.use(
    "*",
    cors({
      origin: "http://localhost:3000",
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Root endpoint
  app.get("/", (c) => {
    return c.json({
      name: "Fyren API",
      version: "0.0.1",
      docs: "/health",
    });
  });

  // Setup all routes
  setupRoutes(app);

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: { message: "Not Found", code: "NOT_FOUND" } }, 404);
  });

  // Global error handler
  app.onError((err, c) => {
    return errorResponse(c, err);
  });

  return app;
}
