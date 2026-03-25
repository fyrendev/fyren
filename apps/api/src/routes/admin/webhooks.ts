import { Hono } from "hono";
import { db, eq, desc } from "@fyrendev/db";
import { webhookEndpoints } from "@fyrendev/db";
import { z } from "zod";
import { randomBytes } from "crypto";
import { errorResponse, NotFoundError, ValidationError } from "../../lib/errors";
import { formatWebhook } from "../../lib/webhooks";
import { getOrganization } from "../../lib/organization";
import { validateExternalUrl } from "../../lib/url-validator";

export const adminWebhooks = new Hono();

/** Strip the secret from webhook responses, replacing with a boolean indicator */
function serializeWebhook(webhook: typeof webhookEndpoints.$inferSelect) {
  const { secret, ...rest } = webhook;
  return { ...rest, hasSecret: !!secret };
}

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["slack", "discord", "teams", "generic"]),
  url: z.string().url(),
  notifyOnIncident: z.boolean().optional().default(true),
  notifyOnMaintenance: z.boolean().optional().default(true),
  notifyOnComponentChange: z.boolean().optional().default(false),
  componentIds: z.array(z.string().uuid()).optional(),
});

const updateWebhookSchema = createWebhookSchema.partial();

// List webhooks
adminWebhooks.get("/", async (c) => {
  try {
    const webhooks = await db.query.webhookEndpoints.findMany({
      orderBy: [desc(webhookEndpoints.createdAt)],
    });

    return c.json({ webhooks: webhooks.map(serializeWebhook) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Get single webhook
adminWebhooks.get("/:id", async (c) => {
  try {
    const webhookId = c.req.param("id");

    const webhook = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, webhookId),
    });

    if (!webhook) {
      throw new NotFoundError("Webhook not found");
    }

    return c.json({ webhook: serializeWebhook(webhook) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Create webhook
adminWebhooks.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = createWebhookSchema.parse(body);

    // SSRF protection: validate URL doesn't resolve to private/internal IPs
    const urlValidation = await validateExternalUrl(data.url);
    if (!urlValidation.valid) {
      throw new ValidationError(`Invalid webhook URL: ${urlValidation.error}`);
    }

    // Generate secret for generic webhooks
    const secret = data.type === "generic" ? randomBytes(32).toString("hex") : null;

    const [webhook] = await db
      .insert(webhookEndpoints)
      .values({
        name: data.name,
        type: data.type,
        url: data.url,
        secret,
        notifyOnIncident: data.notifyOnIncident,
        notifyOnMaintenance: data.notifyOnMaintenance,
        notifyOnComponentChange: data.notifyOnComponentChange,
        componentIds: data.componentIds || null,
      })
      .returning();

    return c.json({ webhook }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Update webhook
adminWebhooks.put("/:id", async (c) => {
  try {
    const webhookId = c.req.param("id");
    const body = await c.req.json();
    const data = updateWebhookSchema.parse(body);

    const existing = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, webhookId),
    });

    if (!existing) {
      throw new NotFoundError("Webhook not found");
    }

    // SSRF protection: validate new URL if changed
    if (data.url !== undefined && data.url !== existing.url) {
      const urlValidation = await validateExternalUrl(data.url);
      if (!urlValidation.valid) {
        throw new ValidationError(`Invalid webhook URL: ${urlValidation.error}`);
      }
    }

    const updateData: Partial<typeof webhookEndpoints.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.notifyOnIncident !== undefined) updateData.notifyOnIncident = data.notifyOnIncident;
    if (data.notifyOnMaintenance !== undefined)
      updateData.notifyOnMaintenance = data.notifyOnMaintenance;
    if (data.notifyOnComponentChange !== undefined)
      updateData.notifyOnComponentChange = data.notifyOnComponentChange;
    if (data.componentIds !== undefined) updateData.componentIds = data.componentIds;

    const [webhook] = await db
      .update(webhookEndpoints)
      .set(updateData)
      .where(eq(webhookEndpoints.id, webhookId))
      .returning();

    return c.json({ webhook: webhook ? serializeWebhook(webhook) : null });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Delete webhook
adminWebhooks.delete("/:id", async (c) => {
  try {
    const webhookId = c.req.param("id");

    const existing = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, webhookId),
    });

    if (!existing) {
      throw new NotFoundError("Webhook not found");
    }

    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, webhookId));

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Toggle webhook enabled/disabled
adminWebhooks.patch("/:id/toggle", async (c) => {
  try {
    const webhookId = c.req.param("id");

    const existing = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, webhookId),
    });

    if (!existing) {
      throw new NotFoundError("Webhook not found");
    }

    const [webhook] = await db
      .update(webhookEndpoints)
      .set({
        enabled: !existing.enabled,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, webhookId))
      .returning();

    return c.json({ webhook: webhook ? serializeWebhook(webhook) : null });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Test webhook
adminWebhooks.post("/:id/test", async (c) => {
  try {
    const webhookId = c.req.param("id");

    const webhook = await db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, webhookId),
    });

    if (!webhook) {
      throw new NotFoundError("Webhook not found");
    }

    // SSRF protection: validate URL before making outbound request
    const urlValidation = await validateExternalUrl(webhook.url);
    if (!urlValidation.valid) {
      return c.json({ success: false, error: `URL blocked: ${urlValidation.error}` });
    }

    const org = await getOrganization();

    // Send test webhook
    const formatted = formatWebhook(
      webhook.type,
      {
        event: "test",
        timestamp: new Date().toISOString(),
        organization: { name: org.name },
        data: { message: "This is a test webhook from Fyren" },
      },
      webhook.secret || undefined
    );

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...formatted.headers,
        },
        body: JSON.stringify(formatted.body),
      });

      if (!response.ok) {
        return c.json({
          success: false,
          error: `HTTP ${response.status}`,
        });
      }

      return c.json({ success: true });
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message });
    }
  } catch (error) {
    return errorResponse(c, error);
  }
});
