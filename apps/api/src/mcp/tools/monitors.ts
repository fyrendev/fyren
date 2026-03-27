import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, monitors, components, monitorResults, eq, desc } from "@fyrendev/db";
import { requireScope } from "../auth";
import { scheduleMonitor, unscheduleMonitor, rescheduleMonitor } from "../../lib/queue";
import { validateExternalUrl } from "../../lib/url-validator";

export function registerMonitorTools(server: McpServer) {
  server.registerTool(
    "list_monitors",
    {
      description: "List all monitors with their current status",
      inputSchema: {
        componentId: z.string().uuid().optional().describe("Filter by component ID"),
        type: z
          .enum(["http", "tcp", "ssl_expiry", "nats"])
          .optional()
          .describe("Filter by monitor type"),
        isActive: z.boolean().optional().describe("Filter by active state"),
      },
    },
    async ({ componentId, type, isActive }) => {
      requireScope("read");

      const allMonitors = await db
        .select({
          monitor: monitors,
          component: { id: components.id, name: components.name },
        })
        .from(monitors)
        .innerJoin(components, eq(monitors.componentId, components.id))
        .orderBy(desc(monitors.createdAt));

      let filtered = allMonitors;
      if (componentId) filtered = filtered.filter((m) => m.monitor.componentId === componentId);
      if (type) filtered = filtered.filter((m) => m.monitor.type === type);
      if (isActive !== undefined)
        filtered = filtered.filter((m) => m.monitor.isActive === isActive);

      const result = await Promise.all(
        filtered.map(async ({ monitor, component }) => {
          const [lastResult] = await db
            .select()
            .from(monitorResults)
            .where(eq(monitorResults.monitorId, monitor.id))
            .orderBy(desc(monitorResults.checkedAt))
            .limit(1);

          return {
            id: monitor.id,
            type: monitor.type,
            url: monitor.url,
            intervalSeconds: monitor.intervalSeconds,
            failureThreshold: monitor.failureThreshold,
            isActive: monitor.isActive,
            component,
            lastStatus: lastResult?.status ?? null,
            lastCheckedAt: monitor.lastCheckedAt?.toISOString() || null,
          };
        })
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ monitors: result }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_monitor",
    {
      description: "Get a monitor with its recent check results",
      inputSchema: {
        id: z.string().uuid().describe("Monitor ID"),
      },
    },
    async ({ id }) => {
      requireScope("read");

      const result = await db
        .select({
          monitor: monitors,
          component: { id: components.id, name: components.name },
        })
        .from(monitors)
        .innerJoin(components, eq(monitors.componentId, components.id))
        .where(eq(monitors.id, id))
        .limit(1);

      if (!result[0]) {
        return {
          content: [{ type: "text" as const, text: "Monitor not found" }],
          isError: true,
        };
      }

      const { monitor, component } = result[0];

      const recentResults = await db
        .select()
        .from(monitorResults)
        .where(eq(monitorResults.monitorId, id))
        .orderBy(desc(monitorResults.checkedAt))
        .limit(20);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...monitor,
                component,
                lastCheckedAt: monitor.lastCheckedAt?.toISOString() || null,
                createdAt: monitor.createdAt.toISOString(),
                updatedAt: monitor.updatedAt.toISOString(),
                recentResults: recentResults.map((r) => ({
                  status: r.status,
                  responseTimeMs: r.responseTimeMs,
                  statusCode: r.statusCode,
                  errorMessage: r.errorMessage,
                  checkedAt: r.checkedAt.toISOString(),
                })),
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
    "create_monitor",
    {
      description: "Create a new monitor for a component",
      inputSchema: {
        componentId: z.string().uuid().describe("Component to monitor"),
        type: z.enum(["http", "tcp", "ssl_expiry", "nats"]).describe("Monitor type"),
        url: z.string().min(1).max(2000).describe("URL or address to monitor"),
        intervalSeconds: z
          .number()
          .int()
          .min(30)
          .max(3600)
          .optional()
          .default(60)
          .describe("Check interval"),
        timeoutMs: z
          .number()
          .int()
          .min(1000)
          .max(30000)
          .optional()
          .default(10000)
          .describe("Timeout in ms"),
        expectedStatusCode: z
          .number()
          .int()
          .min(100)
          .max(599)
          .optional()
          .describe("Expected HTTP status code"),
        failureThreshold: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .default(3)
          .describe("Failures before status change"),
        isActive: z.boolean().optional().default(true).describe("Whether the monitor is active"),
        createIncidentOnFailure: z
          .boolean()
          .optional()
          .default(false)
          .describe("Auto-create incident on failure"),
        autoResolveIncident: z
          .boolean()
          .optional()
          .default(true)
          .describe("Auto-resolve incident on recovery"),
      },
    },
    async (args) => {
      requireScope("read-write");

      // Verify component exists
      const [component] = await db
        .select()
        .from(components)
        .where(eq(components.id, args.componentId))
        .limit(1);
      if (!component) {
        return {
          content: [{ type: "text" as const, text: "Component not found" }],
          isError: true,
        };
      }

      // SSRF protection
      const urlValidation = await validateExternalUrl(args.url);
      if (!urlValidation.valid) {
        return {
          content: [{ type: "text" as const, text: `Invalid monitor URL: ${urlValidation.error}` }],
          isError: true,
        };
      }

      const [monitor] = await db
        .insert(monitors)
        .values({
          componentId: args.componentId,
          type: args.type,
          url: args.url,
          intervalSeconds: args.intervalSeconds,
          timeoutMs: args.timeoutMs,
          expectedStatusCode: args.type === "http" ? (args.expectedStatusCode ?? 200) : null,
          failureThreshold: args.failureThreshold,
          isActive: args.isActive,
          createIncidentOnFailure: args.createIncidentOnFailure,
          autoResolveIncident: args.autoResolveIncident,
        })
        .returning();

      if (!monitor) {
        return {
          content: [{ type: "text" as const, text: "Failed to create monitor" }],
          isError: true,
        };
      }

      if (monitor.isActive) {
        await scheduleMonitor(monitor);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: monitor.id,
                type: monitor.type,
                url: monitor.url,
                intervalSeconds: monitor.intervalSeconds,
                isActive: monitor.isActive,
                createdAt: monitor.createdAt.toISOString(),
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
    "update_monitor",
    {
      description: "Update a monitor's configuration",
      inputSchema: {
        id: z.string().uuid().describe("Monitor ID"),
        url: z.string().min(1).max(2000).optional().describe("New URL"),
        intervalSeconds: z
          .number()
          .int()
          .min(30)
          .max(3600)
          .optional()
          .describe("New check interval"),
        timeoutMs: z.number().int().min(1000).max(30000).optional().describe("New timeout"),
        failureThreshold: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("New failure threshold"),
        isActive: z.boolean().optional().describe("Enable/disable monitor"),
        createIncidentOnFailure: z.boolean().optional().describe("Auto-create incident on failure"),
        autoResolveIncident: z.boolean().optional().describe("Auto-resolve incident on recovery"),
      },
    },
    async ({ id, ...data }) => {
      requireScope("read-write");

      const [existing] = await db.select().from(monitors).where(eq(monitors.id, id)).limit(1);
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "Monitor not found" }],
          isError: true,
        };
      }

      // SSRF protection for URL changes
      if (data.url !== undefined && data.url !== existing.url) {
        const urlValidation = await validateExternalUrl(data.url);
        if (!urlValidation.valid) {
          return {
            content: [
              { type: "text" as const, text: `Invalid monitor URL: ${urlValidation.error}` },
            ],
            isError: true,
          };
        }
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) updateData[key] = value;
      }

      const [updated] = await db
        .update(monitors)
        .set(updateData)
        .where(eq(monitors.id, id))
        .returning();

      if (!updated) {
        return {
          content: [{ type: "text" as const, text: "Failed to update monitor" }],
          isError: true,
        };
      }

      // Reschedule if interval or active state changed
      if (data.intervalSeconds !== undefined || data.isActive !== undefined) {
        await rescheduleMonitor(updated);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: updated.id,
                type: updated.type,
                url: updated.url,
                intervalSeconds: updated.intervalSeconds,
                isActive: updated.isActive,
                updatedAt: updated.updatedAt.toISOString(),
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
    "delete_monitor",
    {
      description: "Delete a monitor and all its results",
      inputSchema: {
        id: z.string().uuid().describe("Monitor ID"),
      },
    },
    async ({ id }) => {
      requireScope("full-access");

      const [existing] = await db.select().from(monitors).where(eq(monitors.id, id)).limit(1);
      if (!existing) {
        return {
          content: [{ type: "text" as const, text: "Monitor not found" }],
          isError: true,
        };
      }

      await unscheduleMonitor(id);
      await db.delete(monitors).where(eq(monitors.id, id));

      return {
        content: [{ type: "text" as const, text: `Deleted monitor ${id} (${existing.url})` }],
      };
    }
  );
}
