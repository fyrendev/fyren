import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { asc, components, db, desc, eq, incidents, maintenances, or } from "@fyrendev/db";
import type { ComponentStatus } from "@fyrendev/db";
import { requireScope } from "../auth";
import { getOrganization } from "../../lib/organization";
import {
  cacheComponentStatus,
  getCachedComponentStatus,
  type ComponentWithStatus,
} from "../../services/cache.service";
import { calculateUptime, getOverallStatus } from "../../services/monitor.service";

async function getPublicComponents(): Promise<ComponentWithStatus[]> {
  const publicComponents = await db
    .select({
      id: components.id,
      name: components.name,
      description: components.description,
      status: components.status,
      displayOrder: components.displayOrder,
      updatedAt: components.updatedAt,
    })
    .from(components)
    .where(eq(components.isPublic, true))
    .orderBy(asc(components.displayOrder));

  return publicComponents.map((comp) => ({
    ...comp,
    status: comp.status as ComponentStatus,
  }));
}

export function registerStatusTools(server: McpServer) {
  server.registerTool(
    "get_status",
    {
      description:
        "Get the full status summary including components, active incidents, and upcoming maintenance",
    },
    async () => {
      requireScope("read");

      const org = await getOrganization();

      let componentList = await getCachedComponentStatus(org.id);
      if (!componentList) {
        componentList = await getPublicComponents();
        await cacheComponentStatus(org.id, componentList);
      }

      const statuses = componentList.map((comp) => comp.status);
      const overall = getOverallStatus(statuses);

      // Active incidents
      const activeIncidents = await db
        .select({
          id: incidents.id,
          title: incidents.title,
          status: incidents.status,
          severity: incidents.severity,
          startedAt: incidents.startedAt,
        })
        .from(incidents)
        .where(
          or(
            eq(incidents.status, "investigating"),
            eq(incidents.status, "identified"),
            eq(incidents.status, "monitoring")
          )
        )
        .orderBy(desc(incidents.startedAt));

      // Upcoming maintenance
      const upcomingMaintenance = await db
        .select({
          id: maintenances.id,
          title: maintenances.title,
          status: maintenances.status,
          scheduledStartAt: maintenances.scheduledStartAt,
          scheduledEndAt: maintenances.scheduledEndAt,
        })
        .from(maintenances)
        .where(or(eq(maintenances.status, "scheduled"), eq(maintenances.status, "in_progress")))
        .orderBy(asc(maintenances.scheduledStartAt));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: overall,
                components: componentList.map((c) => ({
                  id: c.id,
                  name: c.name,
                  description: c.description,
                  status: c.status,
                })),
                activeIncidents: activeIncidents.map((i) => ({
                  id: i.id,
                  title: i.title,
                  status: i.status,
                  severity: i.severity,
                  startedAt: i.startedAt.toISOString(),
                })),
                upcomingMaintenance: upcomingMaintenance.map((m) => ({
                  id: m.id,
                  title: m.title,
                  status: m.status,
                  scheduledStartAt: m.scheduledStartAt.toISOString(),
                  scheduledEndAt: m.scheduledEndAt.toISOString(),
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
    "get_uptime",
    {
      description: "Get uptime percentages for all public components",
      inputSchema: {
        period: z
          .enum(["24h", "7d", "30d", "90d"])
          .optional()
          .default("30d")
          .describe("Time period for uptime calculation"),
      },
    },
    async ({ period }) => {
      requireScope("read");

      const publicComps = await db
        .select({ id: components.id, name: components.name })
        .from(components)
        .where(eq(components.isPublic, true))
        .orderBy(asc(components.displayOrder));

      const results = await Promise.all(
        publicComps.map(async (comp) => {
          const stats = await calculateUptime(comp.id, period);
          return {
            id: comp.id,
            name: comp.name,
            uptimePercentage: stats.uptimePercentage,
            totalChecks: stats.totalChecks,
            successfulChecks: stats.successfulChecks,
          };
        })
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ period, components: results }, null, 2),
          },
        ],
      };
    }
  );
}
