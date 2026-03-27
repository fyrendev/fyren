import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db, components, componentStatusEnum, monitors, eq } from "@fyrendev/db";
import { requireScope } from "../auth";
import { unscheduleMonitor } from "../../lib/queue";
import { invalidateStatusCache } from "../../services/cache.service";
import { getOrganization } from "../../lib/organization";

const componentStatuses = componentStatusEnum.enumValues;

export function registerComponentTools(server: McpServer) {
  server.registerTool(
    "list_components",
    {
      description: "List all components with their current status",
      inputSchema: {
        status: z.enum(componentStatuses).optional().describe("Filter by component status"),
      },
    },
    async ({ status }) => {
      requireScope("read");

      let query = db.select().from(components).$dynamic();
      if (status) {
        query = query.where(eq(components.status, status));
      }
      const result = await query.orderBy(components.displayOrder);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                components: result.map((c) => ({
                  id: c.id,
                  name: c.name,
                  description: c.description,
                  status: c.status,
                  displayOrder: c.displayOrder,
                  isPublic: c.isPublic,
                  createdAt: c.createdAt.toISOString(),
                  updatedAt: c.updatedAt.toISOString(),
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
    "get_component",
    {
      description: "Get a single component by ID",
      inputSchema: {
        id: z.string().uuid().describe("Component ID"),
      },
    },
    async ({ id }) => {
      requireScope("read");

      const [comp] = await db.select().from(components).where(eq(components.id, id)).limit(1);
      if (!comp) {
        return {
          content: [{ type: "text" as const, text: "Component not found" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: comp.id,
                name: comp.name,
                description: comp.description,
                status: comp.status,
                displayOrder: comp.displayOrder,
                isPublic: comp.isPublic,
                createdAt: comp.createdAt.toISOString(),
                updatedAt: comp.updatedAt.toISOString(),
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
    "create_component",
    {
      description: "Create a new component",
      inputSchema: {
        name: z.string().min(1).max(255).describe("Component name"),
        description: z.string().max(1000).optional().describe("Component description"),
        status: z
          .enum(componentStatuses)
          .optional()
          .default("operational")
          .describe("Initial status"),
        displayOrder: z.number().int().min(0).optional().default(0).describe("Display order"),
        isPublic: z
          .boolean()
          .optional()
          .default(true)
          .describe("Whether the component is publicly visible"),
      },
    },
    async (args) => {
      requireScope("read-write");

      const [comp] = await db
        .insert(components)
        .values({
          name: args.name,
          description: args.description,
          status: args.status,
          displayOrder: args.displayOrder,
          isPublic: args.isPublic,
        })
        .returning();

      if (!comp) {
        return {
          content: [{ type: "text" as const, text: "Failed to create component" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: comp.id,
                name: comp.name,
                description: comp.description,
                status: comp.status,
                displayOrder: comp.displayOrder,
                isPublic: comp.isPublic,
                createdAt: comp.createdAt.toISOString(),
                updatedAt: comp.updatedAt.toISOString(),
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
    "update_component",
    {
      description: "Update a component's metadata (name, description, display order, visibility)",
      inputSchema: {
        id: z.string().uuid().describe("Component ID"),
        name: z.string().min(1).max(255).optional().describe("New name"),
        description: z.string().max(1000).optional().describe("New description"),
        displayOrder: z.number().int().min(0).optional().describe("New display order"),
        isPublic: z.boolean().optional().describe("Whether the component is publicly visible"),
      },
    },
    async ({ id, ...data }) => {
      requireScope("read-write");

      const [comp] = await db
        .update(components)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(components.id, id))
        .returning();

      if (!comp) {
        return {
          content: [{ type: "text" as const, text: "Component not found" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: comp.id,
                name: comp.name,
                description: comp.description,
                status: comp.status,
                displayOrder: comp.displayOrder,
                isPublic: comp.isPublic,
                createdAt: comp.createdAt.toISOString(),
                updatedAt: comp.updatedAt.toISOString(),
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
    "update_component_status",
    {
      description: "Manually update a component's operational status",
      inputSchema: {
        id: z.string().uuid().describe("Component ID"),
        status: z.enum(componentStatuses).describe("New status"),
      },
    },
    async ({ id, status }) => {
      requireScope("read-write");

      const [comp] = await db
        .update(components)
        .set({ status, updatedAt: new Date() })
        .where(eq(components.id, id))
        .returning();

      if (!comp) {
        return {
          content: [{ type: "text" as const, text: "Component not found" }],
          isError: true,
        };
      }

      // Invalidate cache
      const org = await getOrganization();
      await invalidateStatusCache(org.id);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ id: comp.id, name: comp.name, status: comp.status }, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "delete_component",
    {
      description: "Delete a component and all associated monitors",
      inputSchema: {
        id: z.string().uuid().describe("Component ID"),
      },
    },
    async ({ id }) => {
      requireScope("full-access");

      // Unschedule monitors first
      const componentMonitors = await db
        .select({ id: monitors.id })
        .from(monitors)
        .where(eq(monitors.componentId, id));
      await Promise.all(componentMonitors.map((m) => unscheduleMonitor(m.id)));

      const [comp] = await db.delete(components).where(eq(components.id, id)).returning();
      if (!comp) {
        return {
          content: [{ type: "text" as const, text: "Component not found" }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: `Deleted component "${comp.name}" (${comp.id})` }],
      };
    }
  );
}
