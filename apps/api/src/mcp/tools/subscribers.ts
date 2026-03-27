import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, eq, desc, sql } from "@fyrendev/db";
import { subscribers } from "@fyrendev/db";
import { requireScope } from "../auth";

export function registerSubscriberTools(server: McpServer) {
  server.registerTool(
    "list_subscribers",
    {
      description: "List email subscribers",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().default(50).describe("Max results"),
        offset: z.number().int().min(0).optional().default(0).describe("Offset for pagination"),
        verified: z
          .enum(["true", "false", "all"])
          .optional()
          .default("all")
          .describe("Filter by verification status"),
      },
    },
    async ({ limit, offset, verified }) => {
      requireScope("read");

      const conditions = [];
      if (verified === "true") conditions.push(eq(subscribers.verified, true));
      else if (verified === "false") conditions.push(eq(subscribers.verified, false));

      const whereClause = conditions.length > 0 ? conditions[0] : undefined;

      const [items, countResult] = await Promise.all([
        db.query.subscribers.findMany({
          where: whereClause,
          orderBy: [desc(subscribers.createdAt)],
          limit,
          offset,
        }),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(subscribers)
          .where(whereClause),
      ]);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                subscribers: items.map((s) => ({
                  id: s.id,
                  email: s.email,
                  verified: s.verified,
                  createdAt: s.createdAt.toISOString(),
                })),
                pagination: {
                  total: Number(countResult[0]?.count || 0),
                  limit,
                  offset,
                },
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
    "remove_subscriber",
    {
      description: "Remove a subscriber by ID",
      inputSchema: {
        id: z.string().uuid().describe("Subscriber ID"),
      },
    },
    async ({ id }) => {
      requireScope("read-write");

      const subscriber = await db.query.subscribers.findFirst({
        where: eq(subscribers.id, id),
      });

      if (!subscriber) {
        return {
          content: [{ type: "text" as const, text: "Subscriber not found" }],
          isError: true,
        };
      }

      await db.delete(subscribers).where(eq(subscribers.id, id));

      return {
        content: [
          { type: "text" as const, text: `Removed subscriber ${subscriber.email} (${id})` },
        ],
      };
    }
  );
}
