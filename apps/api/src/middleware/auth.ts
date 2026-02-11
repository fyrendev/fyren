import type { UserOrganization } from "@fyrendev/db";
import { and, apiKeys, db, eq, userOrganizations } from "@fyrendev/db";
import { createMiddleware } from "hono/factory";
import { extractKeyPrefix, isValidApiKeyFormat, verifyApiKey } from "../lib/api-key";
import type { AuthUser, Session } from "../lib/auth";
import { ForbiddenError, UnauthorizedError, errorResponse } from "../lib/errors";
import { getSession } from "./session";
import { logger } from "../lib/logging";

declare module "hono" {
  interface ContextVariableMap {
    session?: Session | null;
    user?: AuthUser | null;
    membership?: UserOrganization | null;
    organizationId?: string | null;
    apiKeyId?: string | null;
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

              c.set("organizationId", apiKeyRecord.organizationId);
              c.set("apiKeyId", apiKeyRecord.id);
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
      c.set("user", session.user);
      c.set("authMethod", "session");

      // For session auth, org ID comes from header
      const orgId = c.req.header("X-Organization-Id");

      if (orgId) {
        // Verify membership
        const [membership] = await db
          .select()
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, session.user.id),
              eq(userOrganizations.organizationId, orgId)
            )
          )
          .limit(1);

        if (!membership) {
          throw new ForbiddenError("Not a member of this organization");
        }

        c.set("membership", membership);
        c.set("organizationId", orgId);
      }

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

              c.set("organizationId", apiKeyRecord.organizationId);
              c.set("apiKeyId", apiKeyRecord.id);
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
      c.set("user", session.user);
      c.set("authMethod", "session");

      const orgId = c.req.header("X-Organization-Id");

      if (orgId) {
        const [membership] = await db
          .select()
          .from(userOrganizations)
          .where(
            and(
              eq(userOrganizations.userId, session.user.id),
              eq(userOrganizations.organizationId, orgId)
            )
          )
          .limit(1);

        if (membership) {
          c.set("membership", membership);
          c.set("organizationId", orgId);
        }
      }
    }

    await next();
  } catch {
    // On any error, just continue without auth
    await next();
  }
});
