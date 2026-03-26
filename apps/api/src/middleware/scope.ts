import type { ApiKeyScope, OrgRole } from "@fyrendev/db";
import { createMiddleware } from "hono/factory";
import { ForbiddenError, errorResponse } from "../lib/errors";

/**
 * Maps API key scopes to the set of org roles they satisfy.
 * Used by requireRole to check if an API key's scope grants sufficient access.
 */
export const SCOPE_ROLE_EQUIVALENCES: Record<ApiKeyScope, OrgRole[]> = {
  "full-access": ["owner", "admin", "member"],
  "read-write": ["admin", "member"],
  read: ["member"],
};

/**
 * Restricts read-scope API keys to GET/HEAD requests only.
 * Must run after authMiddleware on all admin routes.
 */
export const enforceApiKeyScope = createMiddleware(async (c, next) => {
  try {
    const authMethod = c.get("authMethod");
    if (authMethod !== "api_key") {
      await next();
      return;
    }

    const scope = c.get("apiKeyScope") as ApiKeyScope | null;
    if (scope === "read") {
      const method = c.req.method.toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        throw new ForbiddenError("Read-only API key cannot perform write operations");
      }
    }

    await next();
  } catch (error) {
    return errorResponse(c, error);
  }
});
