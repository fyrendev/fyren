import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../lib/db";
import { apiKeys, eq, and } from "@fyrendev/db";
import { generateApiKey } from "../../lib/api-key";
import { NotFoundError, ForbiddenError, errorResponse } from "../../lib/errors";

const adminApiKeys = new Hono();

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().datetime().optional(),
});

// GET /api/v1/admin/api-keys - List all API keys
adminApiKeys.get("/", async (c) => {
  try {
    const orgId = c.get("organizationId")!;

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, orgId));

    return c.json({
      apiKeys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        lastUsedAt: key.lastUsedAt?.toISOString() || null,
        expiresAt: key.expiresAt?.toISOString() || null,
        createdAt: key.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/api-keys - Create new API key
adminApiKeys.post("/", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const body = await c.req.json();
    const data = createApiKeySchema.parse(body);

    const apiKeyData = await generateApiKey();

    const result = await db
      .insert(apiKeys)
      .values({
        organizationId: orgId,
        name: data.name,
        keyHash: apiKeyData.keyHash,
        keyPrefix: apiKeyData.keyPrefix,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      })
      .returning();

    const key = result[0];
    if (!key) {
      throw new Error("Failed to create API key");
    }

    return c.json(
      {
        apiKey: {
          id: key.id,
          name: key.name,
          keyPrefix: key.keyPrefix,
          lastUsedAt: key.lastUsedAt?.toISOString() || null,
          expiresAt: key.expiresAt?.toISOString() || null,
          createdAt: key.createdAt.toISOString(),
        },
        key: apiKeyData.key, // Plain key only returned on creation
      },
      201
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// DELETE /api/v1/admin/api-keys/:id - Delete API key
adminApiKeys.delete("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const apiKeyId = c.get("apiKeyId");
    const id = c.req.param("id");

    // Cannot delete the key being used for the current request
    if (apiKeyId === id) {
      throw new ForbiddenError("Cannot delete the API key being used for this request");
    }

    const result = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, orgId)))
      .returning();

    const key = result[0];
    if (!key) {
      throw new NotFoundError("API key not found");
    }

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminApiKeys };
