import { apiKeys, db, eq, users } from "@fyrendev/db";
import { createMiddleware } from "hono/factory";
import { extractKeyPrefix, isValidApiKeyFormat, verifyApiKey } from "../lib/api-key";
import type { AuthUser, Session } from "../lib/auth";
import { UnauthorizedError, errorResponse } from "../lib/errors";
import { getSession } from "./session";
import { logger } from "../lib/logging";

/**
 * Fetch the user's current role from the DB.
 * BetterAuth's cookie cache may not include custom fields like `role`,
 * so we always fetch it fresh to ensure it's up to date.
 */
async function enrichUserWithRole(user: AuthUser): Promise<AuthUser> {
  const [dbUser] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  return { ...user, role: dbUser?.role || null } as AuthUser;
}

declare module "hono" {
  interface ContextVariableMap {
    session?: Session | null;
    user?: AuthUser | null;
    apiKeyId?: string | null;
    apiKeyScope?: string | null;
    authMethod?: "session" | "api_key" | null;
    requestId?: string;
  }
}

// Combined auth: accepts either session or API key
export const authMiddleware = createMiddleware(async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");

    // Try API key first (for programmatic access)
    if (authHeader?.startsWith("Bearer fyr_") || authHeader?.startsWith("fyr_")) {
      let apiKey: string;
      if (authHeader.startsWith("Bearer ")) {
        apiKey = authHeader.slice(7);
      } else {
        apiKey = authHeader;
      }

      if (isValidApiKeyFormat(apiKey)) {
        const keyPrefix = extractKeyPrefix(apiKey);

        const [apiKeyRecord] = await db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.keyPrefix, keyPrefix))
          .limit(1);

        if (apiKeyRecord) {
          // Check expiration
          if (!apiKeyRecord.expiresAt || apiKeyRecord.expiresAt >= new Date()) {
            const isValid = await verifyApiKey(apiKey, apiKeyRecord.keyHash);

            if (isValid) {
              // Update last used timestamp (fire and forget)
              db.update(apiKeys)
                .set({ lastUsedAt: new Date() })
                .where(eq(apiKeys.id, apiKeyRecord.id))
                .execute()
                .catch((err) =>
                  logger.error("Failed to update API key last used timestamp", {
                    errorMessage: err.message,
                  })
                );

              c.set("apiKeyId", apiKeyRecord.id);
              c.set("apiKeyScope", apiKeyRecord.scope);
              c.set("authMethod", "api_key");

              await next();
              return;
            }
          }
        }

        throw new UnauthorizedError("Invalid API key");
      }
    }

    // Try session auth (for browser access)
    const session = await getSession(c.req.raw.headers);

    if (session) {
      c.set("session", session);
      c.set("user", await enrichUserWithRole(session.user));
      c.set("authMethod", "session");

      await next();
      return;
    }

    throw new UnauthorizedError("Unauthorized");
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Optional auth middleware - sets auth context if provided, but doesn't fail if not
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");

    // Try API key first
    if (authHeader?.startsWith("Bearer fyr_") || authHeader?.startsWith("fyr_")) {
      let apiKey: string;
      if (authHeader.startsWith("Bearer ")) {
        apiKey = authHeader.slice(7);
      } else {
        apiKey = authHeader;
      }

      if (isValidApiKeyFormat(apiKey)) {
        const keyPrefix = extractKeyPrefix(apiKey);

        const [apiKeyRecord] = await db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.keyPrefix, keyPrefix))
          .limit(1);

        if (apiKeyRecord) {
          if (!apiKeyRecord.expiresAt || apiKeyRecord.expiresAt >= new Date()) {
            const isValid = await verifyApiKey(apiKey, apiKeyRecord.keyHash);

            if (isValid) {
              db.update(apiKeys)
                .set({ lastUsedAt: new Date() })
                .where(eq(apiKeys.id, apiKeyRecord.id))
                .execute()
                .catch((err) =>
                  logger.error("Failed to update API key last used timestamp", {
                    errorMessage: err.message,
                  })
                );

              c.set("apiKeyId", apiKeyRecord.id);
              c.set("apiKeyScope", apiKeyRecord.scope);
              c.set("authMethod", "api_key");

              await next();
              return;
            }
          }
        }
      }
    }

    // Try session auth
    const session = await getSession(c.req.raw.headers);

    if (session) {
      c.set("session", session);
      c.set("user", await enrichUserWithRole(session.user));
      c.set("authMethod", "session");
    }

    await next();
  } catch (error) {
    logger.warn("Optional auth check failed, continuing unauthenticated", {
      error: error instanceof Error ? error.message : String(error),
    });
    await next();
  }
});
