import { createMiddleware } from "hono/factory";
import { db, apiKeys, userOrganizations, eq, and } from "@fyrendev/db";
import { extractKeyPrefix, verifyApiKey, isValidApiKeyFormat } from "../lib/api-key";
import { getSession } from "./session";
import { UnauthorizedError, ForbiddenError, errorResponse } from "../lib/errors";
import type { Session, AuthUser } from "../lib/auth";
import type { UserOrganization } from "@fyrendev/db";

export type AuthContext = {
  organizationId: string;
  apiKeyId: string;
};

declare module "hono" {
  interface ContextVariableMap {
    // Legacy API key auth context
    auth?: AuthContext;
    // New auth context
    session?: Session | null;
    user?: AuthUser | null;
    membership?: UserOrganization | null;
    organizationId?: string | null;
    apiKeyId?: string | null;
    authMethod?: "session" | "api_key" | null;
  }
}

// API key only auth (legacy, for backwards compatibility)
export const authMiddleware = createMiddleware(async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      throw new UnauthorizedError("Missing Authorization header");
    }

    // Support both "Bearer fyr_xxx" and "fyr_xxx" formats
    let apiKey: string;
    if (authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7);
    } else if (authHeader.startsWith("fyr_")) {
      apiKey = authHeader;
    } else {
      throw new UnauthorizedError("Invalid Authorization header format");
    }

    if (!isValidApiKeyFormat(apiKey)) {
      throw new UnauthorizedError("Invalid API key format");
    }

    const keyPrefix = extractKeyPrefix(apiKey);

    // Look up key by prefix
    const [apiKeyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    if (!apiKeyRecord) {
      throw new UnauthorizedError("Invalid API key");
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      throw new UnauthorizedError("API key has expired");
    }

    // Verify the full key
    const isValid = await verifyApiKey(apiKey, apiKeyRecord.keyHash);
    if (!isValid) {
      throw new UnauthorizedError("Invalid API key");
    }

    // Update last used timestamp (fire and forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyRecord.id))
      .execute()
      .catch(console.error);

    // Set legacy auth context
    c.set("auth", {
      organizationId: apiKeyRecord.organizationId,
      apiKeyId: apiKeyRecord.id,
    });

    // Set new auth context
    c.set("organizationId", apiKeyRecord.organizationId);
    c.set("apiKeyId", apiKeyRecord.id);
    c.set("authMethod", "api_key");

    await next();
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Combined auth: accepts either session or API key
export const requireAuthOrApiKey = createMiddleware(async (c, next) => {
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
                .catch(console.error);

              // Set auth context
              c.set("auth", {
                organizationId: apiKeyRecord.organizationId,
                apiKeyId: apiKeyRecord.id,
              });
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

      // For session auth, org ID can come from header or param
      const orgId = c.req.param("orgId") || c.req.header("X-Organization-Id");

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

        // Set legacy auth context for backwards compatibility
        c.set("auth", {
          organizationId: orgId,
          apiKeyId: "", // Not applicable for session auth
        });
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
                .catch(console.error);

              c.set("auth", {
                organizationId: apiKeyRecord.organizationId,
                apiKeyId: apiKeyRecord.id,
              });
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

      const orgId = c.req.param("orgId") || c.req.header("X-Organization-Id");

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
          c.set("auth", {
            organizationId: orgId,
            apiKeyId: "",
          });
        }
      }
    }

    await next();
  } catch (error) {
    // On any error, just continue without auth
    await next();
  }
});
