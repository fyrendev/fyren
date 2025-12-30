import { createMiddleware } from "hono/factory";
import { db } from "../lib/db";
import { apiKeys, eq } from "@fyrendev/db";
import { extractKeyPrefix, verifyApiKey, isValidApiKeyFormat } from "../lib/api-key";
import { UnauthorizedError, errorResponse } from "../lib/errors";

export type AuthContext = {
  organizationId: string;
  apiKeyId: string;
};

declare module "hono" {
  interface ContextVariableMap {
    auth?: AuthContext;
  }
}

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

    // Set auth context
    c.set("auth", {
      organizationId: apiKeyRecord.organizationId,
      apiKeyId: apiKeyRecord.id,
    });

    await next();
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Optional auth middleware - sets auth context if provided, but doesn't fail if not
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      // No auth header, just continue without auth context
      await next();
      return;
    }

    // Support both "Bearer fyr_xxx" and "fyr_xxx" formats
    let apiKey: string;
    if (authHeader.startsWith("Bearer ")) {
      apiKey = authHeader.slice(7);
    } else if (authHeader.startsWith("fyr_")) {
      apiKey = authHeader;
    } else {
      // Invalid format, continue without auth
      await next();
      return;
    }

    if (!isValidApiKeyFormat(apiKey)) {
      // Invalid format, continue without auth
      await next();
      return;
    }

    const keyPrefix = extractKeyPrefix(apiKey);

    // Look up key by prefix
    const [apiKeyRecord] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyPrefix, keyPrefix))
      .limit(1);

    if (!apiKeyRecord) {
      // Invalid key, continue without auth
      await next();
      return;
    }

    // Check expiration
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      // Expired key, continue without auth
      await next();
      return;
    }

    // Verify the full key
    const isValid = await verifyApiKey(apiKey, apiKeyRecord.keyHash);
    if (!isValid) {
      // Invalid key, continue without auth
      await next();
      return;
    }

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

    await next();
  } catch (error) {
    // On any error, just continue without auth
    await next();
  }
});
