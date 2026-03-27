import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, eq, desc } from "@fyrendev/db";
import { webhookEndpoints } from "@fyrendev/db";
import { randomBytes } from "crypto";
import { requireScope } from "../auth";
import { validateExternalUrl } from "../../lib/url-validator";

export function registerWebhookTools(server: McpServer) {
  server.registerTool("list_webhooks", { description: "List all webhook endpoints" }, async () => {
    requireScope("read");

    const webhooks = await db.query.webhookEndpoints.findMany({
      orderBy: [desc(webhookEndpoints.createdAt)],
    });

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              webhooks: webhooks.map((w) => ({
                id: w.id,
                name: w.name,
                type: w.type,
                url: w.url,
                enabled: w.enabled,
                notifyOnIncident: w.notifyOnIncident,
                notifyOnMaintenance: w.notifyOnMaintenance,
                notifyOnComponentChange: w.notifyOnComponentChange,
                createdAt: w.createdAt.toISOString(),
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  });

  server.registerTool(
    "create_webhook",
    {
      description: "Create a new webhook endpoint",
      inputSchema: {
        name: z.string().min(1).max(100).describe("Webhook name"),
        type: z.enum(["slack", "discord", "teams", "generic"]).describe("Webhook type"),
        url: z.string().url().describe("Webhook URL"),
        notifyOnIncident: z
          .boolean()
          .optional()
          .default(true)
          .describe("Notify on incident events"),
        notifyOnMaintenance: z
          .boolean()
          .optional()
          .default(true)
          .describe("Notify on maintenance events"),
        notifyOnComponentChange: z
          .boolean()
          .optional()
          .default(false)
          .describe("Notify on component status changes"),
        componentIds: z
          .array(z.string().uuid())
          .optional()
          .describe("Filter to specific components"),
      },
    },
    async (args) => {
      requireScope("read-write");

      // SSRF protection
      const urlValidation = await validateExternalUrl(args.url);
      if (!urlValidation.valid) {
        return {
          content: [{ type: "text" as const, text: `Invalid webhook URL: ${urlValidation.error}` }],
          isError: true,
        };
      }

      const secret = args.type === "generic" ? randomBytes(32).toString("hex") : null;

      const [webhook] = await db
        .insert(webhookEndpoints)
        .values({
          name: args.name,
          type: args.type,
          url: args.url,
          secret,
          notifyOnIncident: args.notifyOnIncident,
          notifyOnMaintenance: args.notifyOnMaintenance,
          notifyOnComponentChange: args.notifyOnComponentChange,
          componentIds: args.componentIds || null,
        })
        .returning();

      if (!webhook) {
        return {
          content: [{ type: "text" as const, text: "Failed to create webhook" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: webhook.id,
                name: webhook.name,
                type: webhook.type,
                url: webhook.url,
                createdAt: webhook.createdAt.toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "update_webhook",
    {
      description: "Update a webhook endpoint",
      inputSchema: {
        id: z.string().uuid().describe("Webhook ID"),
        name: z.string().min(1).max(100).optional().describe("New name"),
        url: z.string().url().optional().describe("New URL"),
        notifyOnIncident: z.boolean().optional().describe("Notify on incident events"),
        notifyOnMaintenance: z.boolean().optional().describe("Notify on maintenance events"),
        notifyOnComponentChange: z
          .boolean()
          .optional()
          .describe("Notify on component status changes"),
        componentIds: z
          .array(z.string().uuid())
          .optional()
          .describe("Filter to specific components"),
      },
    },
    async ({ id, ...data }) => {
      requireScope("read-write");

      const existing = await db.query.webhookEndpoints.findFirst({
        where: eq(webhookEndpoints.id, id),
      });
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "Webhook not found" }],
          isError: true,
        };
      }

      // SSRF protection for URL changes
      if (data.url !== undefined && data.url !== existing.url) {
        const urlValidation = await validateExternalUrl(data.url);
        if (!urlValidation.valid) {
          return {
            content: [
              { type: "text" as const, text: `Invalid webhook URL: ${urlValidation.error}` },
            ],
            isError: true,
          };
        }
      }

      const updateData: Partial<typeof webhookEndpoints.$inferInsert> = { updatedAt: new Date() };
      if (data.name !== undefined) updateData.name = data.name;
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
        .where(eq(webhookEndpoints.id, id))
        .returning();

      if (!webhook) {
        return {
          content: [{ type: "text" as const, text: "Failed to update webhook" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: webhook.id,
                name: webhook.name,
                type: webhook.type,
                url: webhook.url,
                updatedAt: webhook.updatedAt.toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_webhook",
    {
      description: "Delete a webhook endpoint",
      inputSchema: {
        id: z.string().uuid().describe("Webhook ID"),
      },
    },
    async ({ id }) => {
      requireScope("full-access");

      const existing = await db.query.webhookEndpoints.findFirst({
        where: eq(webhookEndpoints.id, id),
      });
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "Webhook not found" }],
          isError: true,
        };
      }

      await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));

      return {
        content: [{ type: "text" as const, text: `Deleted webhook "${existing.name}" (${id})` }],
      };
    }
  );
}
