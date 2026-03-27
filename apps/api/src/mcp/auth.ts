import { getContext } from "hono/context-storage";
import type { ApiKeyScope } from "@fyrendev/db";

const SCOPE_HIERARCHY: Record<ApiKeyScope, number> = {
  read: 0,
  "read-write": 1,
  "full-access": 2,
};

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

export function getAuthContext() {
  const c = getContext();
  return {
    apiKeyId: c.var.apiKeyId as string | null | undefined,
    apiKeyScope: c.var.apiKeyScope as ApiKeyScope | null | undefined,
    authMethod: c.var.authMethod as "session" | "api_key" | null | undefined,
  };
}

/**
 * Check that the current API key scope meets the minimum required scope.
 * Throws McpAuthError if insufficient — the MCP SDK catches this and returns it as a tool error.
 */
export function requireScope(minimum: ApiKeyScope): void {
  const { apiKeyScope, authMethod } = getAuthContext();

  // Session auth (browser) has full access
  if (authMethod === "session") return;

  if (!apiKeyScope) {
    throw new McpAuthError("No API key scope found");
  }

  if (SCOPE_HIERARCHY[apiKeyScope] < SCOPE_HIERARCHY[minimum]) {
    throw new McpAuthError(
      `Insufficient scope: requires '${minimum}', but API key has '${apiKeyScope}'`
    );
  }
}
