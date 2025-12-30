import { Hono } from "hono";
import {
  db,
  organizations,
  components,
  eq,
  asc,
} from "@fyrendev/db";
import { NotFoundError, errorResponse } from "../../lib/errors";
import {
  getCachedComponentStatus,
  cacheComponentStatus,
  type ComponentWithStatus,
} from "../../services/cache.service";
import {
  calculateUptime,
  getOverallStatus,
} from "../../services/monitor.service";
import type { ComponentStatus } from "@fyrendev/db";

export const publicStatus = new Hono();

// GET /api/v1/status/:slug - Full status summary
publicStatus.get("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    // Try cache first
    let componentList = await getCachedComponentStatus(slug);

    if (!componentList) {
      // Fetch from database
      const orgComponents = await db
        .select({
          id: components.id,
          name: components.name,
          description: components.description,
          status: components.status,
          displayOrder: components.displayOrder,
          updatedAt: components.updatedAt,
        })
        .from(components)
        .where(eq(components.organizationId, org.id))
        .orderBy(asc(components.displayOrder));

      componentList = orgComponents.map((comp) => ({
        ...comp,
        status: comp.status as ComponentStatus,
      }));

      // Cache the result
      await cacheComponentStatus(slug, componentList);
    }

    // Calculate overall status
    const statuses = componentList.map((c) => c.status);
    const overall = getOverallStatus(statuses);

    return c.json({
      status: {
        indicator: overall.indicator,
        description: overall.description,
      },
      components: componentList.map((comp) => ({
        id: comp.id,
        name: comp.name,
        status: comp.status,
        updatedAt: comp.updatedAt,
      })),
      // Placeholder for future phases
      activeIncidents: [],
      scheduledMaintenance: [],
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/:slug/components - Components with status
publicStatus.get("/:slug/components", async (c) => {
  try {
    const slug = c.req.param("slug");

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    // Try cache first
    let componentList = await getCachedComponentStatus(slug);

    if (!componentList) {
      // Fetch from database
      const orgComponents = await db
        .select({
          id: components.id,
          name: components.name,
          description: components.description,
          status: components.status,
          displayOrder: components.displayOrder,
          updatedAt: components.updatedAt,
        })
        .from(components)
        .where(eq(components.organizationId, org.id))
        .orderBy(asc(components.displayOrder));

      componentList = orgComponents.map((comp) => ({
        ...comp,
        status: comp.status as ComponentStatus,
      }));

      // Cache the result
      await cacheComponentStatus(slug, componentList);
    }

    return c.json({
      components: componentList,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/:slug/uptime - Uptime percentages
publicStatus.get("/:slug/uptime", async (c) => {
  try {
    const slug = c.req.param("slug");

    // Get organization
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    // Get all public components
    const orgComponents = await db
      .select({
        id: components.id,
        name: components.name,
      })
      .from(components)
      .where(eq(components.organizationId, org.id))
      .orderBy(asc(components.displayOrder));

    // Calculate uptime for each component
    const periods: Array<"24h" | "7d" | "30d" | "90d"> = ["24h", "7d", "30d", "90d"];

    const componentsWithUptime = await Promise.all(
      orgComponents.map(async (comp) => {
        const uptime: Record<string, number> = {};

        for (const period of periods) {
          const stats = await calculateUptime(comp.id, period);
          uptime[period] = stats.uptimePercentage;
        }

        return {
          id: comp.id,
          name: comp.name,
          uptime,
        };
      })
    );

    return c.json({
      components: componentsWithUptime,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
