import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MaintenanceService } from "../../services/maintenance.service";
import { requireScope } from "../auth";

export function registerMaintenanceTools(server: McpServer) {
  server.registerTool(
    "list_maintenance",
    {
      description: "List maintenance windows with optional filters",
      inputSchema: {
        status: z
          .enum(["scheduled", "in_progress", "completed", "cancelled"])
          .optional()
          .describe("Filter by maintenance status"),
        upcoming: z.boolean().optional().describe("Only show upcoming/active maintenance"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("Max results"),
        offset: z.number().int().min(0).optional().default(0).describe("Offset for pagination"),
      },
    },
    async (args) => {
      requireScope("read");

      const result = await MaintenanceService.list(args);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                maintenances: result.maintenances.map((m) => ({
                  id: m.id,
                  title: m.title,
                  description: m.description,
                  status: m.status,
                  affectedComponents: m.affectedComponents,
                  scheduledStartAt: m.scheduledStartAt.toISOString(),
                  scheduledEndAt: m.scheduledEndAt.toISOString(),
                  startedAt: m.startedAt?.toISOString() || null,
                  completedAt: m.completedAt?.toISOString() || null,
                  autoStart: m.autoStart,
                  autoComplete: m.autoComplete,
                })),
                pagination: result.pagination,
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
    "get_maintenance",
    {
      description: "Get a single maintenance window by ID",
      inputSchema: {
        id: z.string().uuid().describe("Maintenance ID"),
      },
    },
    async ({ id }) => {
      requireScope("read");

      const maintenance = await MaintenanceService.getById(id);
      if (!maintenance) {
        return {
          content: [{ type: "text" as const, text: "Maintenance not found" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: maintenance.id,
                title: maintenance.title,
                description: maintenance.description,
                status: maintenance.status,
                affectedComponents: maintenance.affectedComponents,
                scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
                scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
                startedAt: maintenance.startedAt?.toISOString() || null,
                completedAt: maintenance.completedAt?.toISOString() || null,
                autoStart: maintenance.autoStart,
                autoComplete: maintenance.autoComplete,
                createdAt: maintenance.createdAt.toISOString(),
                updatedAt: maintenance.updatedAt.toISOString(),
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
    "create_maintenance",
    {
      description: "Schedule a new maintenance window",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Maintenance title"),
        description: z.string().max(5000).optional().describe("Maintenance description"),
        scheduledStartAt: z.string().datetime().describe("Start time (ISO 8601)"),
        scheduledEndAt: z.string().datetime().describe("End time (ISO 8601)"),
        componentIds: z.array(z.string().uuid()).min(1).describe("IDs of affected components"),
        autoStart: z
          .boolean()
          .optional()
          .default(true)
          .describe("Automatically start at scheduled time"),
        autoComplete: z
          .boolean()
          .optional()
          .default(true)
          .describe("Automatically complete at scheduled end"),
      },
    },
    async (args) => {
      requireScope("read-write");

      const maintenance = await MaintenanceService.create({
        title: args.title,
        description: args.description,
        scheduledStartAt: new Date(args.scheduledStartAt),
        scheduledEndAt: new Date(args.scheduledEndAt),
        componentIds: args.componentIds,
        autoStart: args.autoStart,
        autoComplete: args.autoComplete,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: maintenance.id,
                title: maintenance.title,
                status: maintenance.status,
                scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
                scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
                createdAt: maintenance.createdAt.toISOString(),
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
    "update_maintenance",
    {
      description: "Update a scheduled maintenance window",
      inputSchema: {
        id: z.string().uuid().describe("Maintenance ID"),
        title: z.string().min(1).max(200).optional().describe("New title"),
        description: z.string().max(5000).optional().describe("New description"),
        scheduledStartAt: z.string().datetime().optional().describe("New start time (ISO 8601)"),
        scheduledEndAt: z.string().datetime().optional().describe("New end time (ISO 8601)"),
        componentIds: z.array(z.string().uuid()).optional().describe("New affected component IDs"),
        autoStart: z.boolean().optional().describe("Auto-start at scheduled time"),
        autoComplete: z.boolean().optional().describe("Auto-complete at scheduled end"),
      },
    },
    async ({ id, ...data }) => {
      requireScope("read-write");

      try {
        const maintenance = await MaintenanceService.update(id, {
          title: data.title,
          description: data.description,
          scheduledStartAt: data.scheduledStartAt ? new Date(data.scheduledStartAt) : undefined,
          scheduledEndAt: data.scheduledEndAt ? new Date(data.scheduledEndAt) : undefined,
          componentIds: data.componentIds,
          autoStart: data.autoStart,
          autoComplete: data.autoComplete,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: maintenance.id,
                  title: maintenance.title,
                  status: maintenance.status,
                  scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
                  scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
                  updatedAt: maintenance.updatedAt.toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message === "Maintenance not found" ||
            error.message === "Can only update scheduled maintenance"
          ) {
            return {
              content: [{ type: "text" as const, text: error.message }],
              isError: true,
            };
          }
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "start_maintenance",
    {
      description: "Start a scheduled maintenance window early",
      inputSchema: {
        id: z.string().uuid().describe("Maintenance ID"),
      },
    },
    async ({ id }) => {
      requireScope("read-write");

      try {
        const maintenance = await MaintenanceService.start(id);
        if (!maintenance) {
          return {
            content: [{ type: "text" as const, text: "Maintenance not found" }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: maintenance.id,
                  title: maintenance.title,
                  status: maintenance.status,
                  startedAt: maintenance.startedAt?.toISOString() || null,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message === "Maintenance not found" ||
            error.message === "Maintenance is not in scheduled status"
          ) {
            return {
              content: [{ type: "text" as const, text: error.message }],
              isError: true,
            };
          }
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "complete_maintenance",
    {
      description: "Mark a maintenance window as complete",
      inputSchema: {
        id: z.string().uuid().describe("Maintenance ID"),
      },
    },
    async ({ id }) => {
      requireScope("read-write");

      try {
        const maintenance = await MaintenanceService.complete(id);
        if (!maintenance) {
          return {
            content: [{ type: "text" as const, text: "Maintenance not found" }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: maintenance.id,
                  title: maintenance.title,
                  status: maintenance.status,
                  completedAt: maintenance.completedAt?.toISOString() || null,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message === "Maintenance not found" ||
            error.message === "Maintenance is not in progress"
          ) {
            return {
              content: [{ type: "text" as const, text: error.message }],
              isError: true,
            };
          }
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "cancel_maintenance",
    {
      description: "Cancel a scheduled or in-progress maintenance window",
      inputSchema: {
        id: z.string().uuid().describe("Maintenance ID"),
      },
    },
    async ({ id }) => {
      requireScope("full-access");

      try {
        await MaintenanceService.cancel(id);
        return {
          content: [{ type: "text" as const, text: `Maintenance ${id} cancelled` }],
        };
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message === "Maintenance not found" ||
            error.message === "Maintenance is already completed or cancelled"
          ) {
            return {
              content: [{ type: "text" as const, text: error.message }],
              isError: true,
            };
          }
        }
        throw error;
      }
    }
  );
}
