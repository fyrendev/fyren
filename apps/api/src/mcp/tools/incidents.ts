import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { IncidentService } from "../../services/incident.service";
import { requireScope } from "../auth";

export function registerIncidentTools(server: McpServer) {
  server.registerTool(
    "list_incidents",
    {
      description: "List incidents with optional filters",
      inputSchema: {
        status: z
          .enum(["active", "resolved", "all"])
          .optional()
          .default("all")
          .describe("Filter by incident status"),
        severity: z.enum(["minor", "major", "critical"]).optional().describe("Filter by severity"),
        limit: z.number().int().min(1).max(100).optional().default(20).describe("Max results"),
        offset: z.number().int().min(0).optional().default(0).describe("Offset for pagination"),
      },
    },
    async (args) => {
      requireScope("read");

      const result = await IncidentService.list(args);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                incidents: result.incidents.map((i) => ({
                  id: i.id,
                  title: i.title,
                  status: i.status,
                  severity: i.severity,
                  affectedComponents: i.affectedComponents,
                  latestUpdate: i.latestUpdate
                    ? {
                        status: i.latestUpdate.status,
                        message: i.latestUpdate.message,
                        createdAt: i.latestUpdate.createdAt.toISOString(),
                      }
                    : null,
                  startedAt: i.startedAt.toISOString(),
                  resolvedAt: i.resolvedAt?.toISOString() || null,
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
    "get_incident",
    {
      description: "Get a single incident with all updates and affected components",
      inputSchema: {
        id: z.string().uuid().describe("Incident ID"),
      },
    },
    async ({ id }) => {
      requireScope("read");

      const incident = await IncidentService.getById(id);
      if (!incident) {
        return {
          content: [{ type: "text" as const, text: "Incident not found" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: incident.id,
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
                affectedComponents: incident.affectedComponents,
                updates: incident.updates.map((u) => ({
                  id: u.id,
                  status: u.status,
                  message: u.message,
                  createdAt: u.createdAt.toISOString(),
                })),
                startedAt: incident.startedAt.toISOString(),
                resolvedAt: incident.resolvedAt?.toISOString() || null,
                createdAt: incident.createdAt.toISOString(),
                updatedAt: incident.updatedAt.toISOString(),
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
    "create_incident",
    {
      description: "Create a new incident and optionally link affected components",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Incident title"),
        severity: z
          .enum(["minor", "major", "critical"])
          .optional()
          .default("minor")
          .describe("Incident severity"),
        status: z
          .enum(["investigating", "identified", "monitoring", "resolved"])
          .optional()
          .default("investigating")
          .describe("Initial status"),
        message: z.string().min(1).max(5000).describe("Initial status update message"),
        componentIds: z
          .array(z.string().uuid())
          .optional()
          .default([])
          .describe("IDs of affected components"),
      },
    },
    async (args) => {
      requireScope("read-write");

      const incident = await IncidentService.create({
        title: args.title,
        severity: args.severity,
        status: args.status,
        message: args.message,
        componentIds: args.componentIds,
      });

      if (!incident) {
        return {
          content: [{ type: "text" as const, text: "Failed to create incident" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: incident.id,
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
                startedAt: incident.startedAt.toISOString(),
                createdAt: incident.createdAt.toISOString(),
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
    "update_incident",
    {
      description: "Update incident metadata (title, severity)",
      inputSchema: {
        id: z.string().uuid().describe("Incident ID"),
        title: z.string().min(1).max(200).optional().describe("New title"),
        severity: z.enum(["minor", "major", "critical"]).optional().describe("New severity"),
      },
    },
    async ({ id, ...data }) => {
      requireScope("read-write");

      const incident = await IncidentService.update(id, data);
      if (!incident) {
        return {
          content: [{ type: "text" as const, text: "Incident not found" }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: incident.id,
                title: incident.title,
                status: incident.status,
                severity: incident.severity,
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
    "add_incident_update",
    {
      description: "Post a status update to an incident",
      inputSchema: {
        id: z.string().uuid().describe("Incident ID"),
        status: z
          .enum(["investigating", "identified", "monitoring", "resolved"])
          .describe("New incident status"),
        message: z.string().min(1).max(5000).describe("Update message"),
      },
    },
    async ({ id, status, message }) => {
      requireScope("read-write");

      try {
        const update = await IncidentService.addUpdate({
          incidentId: id,
          status,
          message,
        });

        if (!update) {
          return {
            content: [{ type: "text" as const, text: "Failed to add update" }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: update.id,
                  status: update.status,
                  message: update.message,
                  createdAt: update.createdAt.toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error && error.message === "Incident not found") {
          return {
            content: [{ type: "text" as const, text: "Incident not found" }],
            isError: true,
          };
        }
        throw error;
      }
    }
  );

  server.registerTool(
    "resolve_incident",
    {
      description: "Resolve an incident with an optional resolution message",
      inputSchema: {
        id: z.string().uuid().describe("Incident ID"),
        message: z.string().max(5000).optional().describe("Resolution message"),
      },
    },
    async ({ id, message }) => {
      requireScope("read-write");

      try {
        const update = await IncidentService.resolve({
          incidentId: id,
          message,
        });

        if (!update) {
          return {
            content: [{ type: "text" as const, text: "Failed to resolve incident" }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  id: update.id,
                  status: update.status,
                  message: update.message,
                  createdAt: update.createdAt.toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        if (error instanceof Error && error.message === "Incident not found") {
          return {
            content: [{ type: "text" as const, text: "Incident not found" }],
            isError: true,
          };
        }
        throw error;
      }
    }
  );
}
