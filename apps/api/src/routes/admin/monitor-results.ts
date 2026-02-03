import { Hono } from "hono";
import { z } from "zod";
import { db, monitors, components, monitorResults, eq, and, desc, sql } from "@fyrendev/db";
import { NotFoundError, ForbiddenError, errorResponse } from "../../lib/errors";

export const adminMonitorResults = new Hono();

// Query params schema
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// GET /api/v1/admin/monitors/:id/results - Get monitor results with pagination
adminMonitorResults.get("/:id/results", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const monitorId = c.req.param("id");

    // Parse query params
    const queryParams = {
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
      from: c.req.query("from"),
      to: c.req.query("to"),
    };

    const validated = querySchema.parse({
      limit: queryParams.limit ? parseInt(queryParams.limit) : undefined,
      offset: queryParams.offset ? parseInt(queryParams.offset) : undefined,
      from: queryParams.from || undefined,
      to: queryParams.to || undefined,
    });

    // Verify monitor exists and belongs to org
    const existingResult = await db
      .select({
        monitor: monitors,
        organizationId: components.organizationId,
      })
      .from(monitors)
      .innerJoin(components, eq(monitors.componentId, components.id))
      .where(eq(monitors.id, monitorId))
      .limit(1);

    const existing = existingResult[0];
    if (!existing) {
      throw new NotFoundError("Monitor not found");
    }

    if (existing.organizationId !== orgId) {
      throw new ForbiddenError("Monitor does not belong to your organization");
    }

    // Build conditions
    const conditions = [eq(monitorResults.monitorId, monitorId)];

    if (validated.from) {
      conditions.push(sql`${monitorResults.checkedAt} >= ${validated.from}`);
    }

    if (validated.to) {
      conditions.push(sql`${monitorResults.checkedAt} <= ${validated.to}`);
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(monitorResults)
      .where(and(...conditions));

    const count = countResult[0]?.count ?? 0;

    // Get results with pagination
    const results = await db
      .select()
      .from(monitorResults)
      .where(and(...conditions))
      .orderBy(desc(monitorResults.checkedAt))
      .limit(validated.limit)
      .offset(validated.offset);

    return c.json({
      results,
      pagination: {
        total: count,
        limit: validated.limit,
        offset: validated.offset,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
