import { Hono } from "hono";
import { z } from "zod";
import {
  db,
  monitors,
  components,
  monitorResults,
  eq,
  and,
  desc,
} from "@fyrendev/db";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  errorResponse,
} from "../../lib/errors";
import {
  scheduleMonitor,
  unscheduleMonitor,
  rescheduleMonitor,
  triggerImmediateCheck,
} from "../../lib/queue";
import { executeCheck } from "../../lib/checkers";
import { storeCheckResult } from "../../services/monitor.service";

export const adminMonitors = new Hono();

// Validation schemas
const createMonitorSchema = z.object({
  componentId: z.string().uuid(),
  type: z.enum(["http", "tcp", "ssl_expiry"]),
  url: z.string().min(1).max(2000),
  intervalSeconds: z.number().int().min(30).max(3600).default(60),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  expectedStatusCode: z.number().int().min(100).max(599).optional(),
  headers: z.record(z.string()).optional(),
  failureThreshold: z.number().int().min(1).max(10).default(3),
  isActive: z.boolean().default(true),
});

const updateMonitorSchema = z.object({
  type: z.enum(["http", "tcp", "ssl_expiry"]).optional(),
  url: z.string().min(1).max(2000).optional(),
  intervalSeconds: z.number().int().min(30).max(3600).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
  expectedStatusCode: z.number().int().min(100).max(599).nullable().optional(),
  headers: z.record(z.string()).nullable().optional(),
  failureThreshold: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

// GET /api/v1/admin/monitors - List monitors
adminMonitors.get("/", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const componentId = c.req.query("componentId");
    const type = c.req.query("type") as "http" | "tcp" | "ssl_expiry" | undefined;
    const isActive = c.req.query("isActive");

    // Build conditions array
    const conditions = [];

    // Get all components for this organization to filter monitors
    const orgComponents = await db
      .select({ id: components.id })
      .from(components)
      .where(eq(components.organizationId, orgId));

    const componentIds = orgComponents.map((c) => c.id);

    if (componentIds.length === 0) {
      return c.json({ monitors: [] });
    }

    // Build query with joins
    let query = db
      .select({
        monitor: monitors,
        component: {
          id: components.id,
          name: components.name,
        },
      })
      .from(monitors)
      .innerJoin(components, eq(monitors.componentId, components.id))
      .where(eq(components.organizationId, orgId));

    // Apply filters
    const allMonitors = await query.orderBy(desc(monitors.createdAt));

    // Filter in application if needed
    let filteredMonitors = allMonitors;

    if (componentId) {
      filteredMonitors = filteredMonitors.filter(
        (m) => m.monitor.componentId === componentId
      );
    }

    if (type) {
      filteredMonitors = filteredMonitors.filter((m) => m.monitor.type === type);
    }

    if (isActive !== undefined) {
      const isActiveValue = isActive === "true";
      filteredMonitors = filteredMonitors.filter(
        (m) => m.monitor.isActive === isActiveValue
      );
    }

    // Get last status for each monitor
    const monitorsWithStatus = await Promise.all(
      filteredMonitors.map(async ({ monitor, component }) => {
        const [lastResult] = await db
          .select()
          .from(monitorResults)
          .where(eq(monitorResults.monitorId, monitor.id))
          .orderBy(desc(monitorResults.checkedAt))
          .limit(1);

        return {
          ...monitor,
          component,
          lastStatus: lastResult?.status ?? null,
        };
      })
    );

    return c.json({ monitors: monitorsWithStatus });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/monitors - Create monitor
adminMonitors.post("/", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const body = await c.req.json();

    const validatedData = createMonitorSchema.parse(body);

    // Verify component belongs to the organization
    const [component] = await db
      .select()
      .from(components)
      .where(
        and(
          eq(components.id, validatedData.componentId),
          eq(components.organizationId, orgId)
        )
      )
      .limit(1);

    if (!component) {
      throw new NotFoundError("Component not found or does not belong to your organization");
    }

    // Type-specific validation
    if (validatedData.type === "http") {
      try {
        new URL(validatedData.url);
      } catch {
        throw new ValidationError("Invalid URL for HTTP monitor");
      }
    } else if (validatedData.type === "tcp") {
      const parts = validatedData.url.replace("tcp://", "").split(":");
      if (parts.length !== 2 || isNaN(parseInt(parts[1]))) {
        throw new ValidationError("Invalid URL for TCP monitor. Expected format: host:port");
      }
    }

    // Create the monitor
    const [newMonitor] = await db
      .insert(monitors)
      .values({
        componentId: validatedData.componentId,
        type: validatedData.type,
        url: validatedData.url,
        intervalSeconds: validatedData.intervalSeconds,
        timeoutMs: validatedData.timeoutMs,
        expectedStatusCode:
          validatedData.type === "http" ? validatedData.expectedStatusCode ?? 200 : null,
        headers: validatedData.type === "http" ? validatedData.headers ?? null : null,
        failureThreshold: validatedData.failureThreshold,
        isActive: validatedData.isActive,
      })
      .returning();

    if (!newMonitor) {
      throw new Error("Failed to create monitor");
    }

    // Schedule the monitor if active
    if (newMonitor.isActive) {
      await scheduleMonitor(newMonitor);
    }

    return c.json({ monitor: newMonitor }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/admin/monitors/:id - Get monitor with recent results
adminMonitors.get("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const monitorId = c.req.param("id");

    // Get monitor with component info
    const result = await db
      .select({
        monitor: monitors,
        component: {
          id: components.id,
          name: components.name,
        },
      })
      .from(monitors)
      .innerJoin(components, eq(monitors.componentId, components.id))
      .where(
        and(
          eq(monitors.id, monitorId),
          eq(components.organizationId, orgId)
        )
      )
      .limit(1);

    const firstResult = result[0];
    if (!firstResult) {
      throw new NotFoundError("Monitor not found");
    }

    const { monitor, component } = firstResult;

    // Get recent results (last 20)
    const recentResults = await db
      .select()
      .from(monitorResults)
      .where(eq(monitorResults.monitorId, monitorId))
      .orderBy(desc(monitorResults.checkedAt))
      .limit(20);

    return c.json({
      monitor: {
        ...monitor,
        component,
        recentResults,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/monitors/:id - Update monitor
adminMonitors.put("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const monitorId = c.req.param("id");
    const body = await c.req.json();

    const validatedData = updateMonitorSchema.parse(body);

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

    const existingMonitor = existing.monitor;

    // Type-specific validation
    if (validatedData.type === "http" && validatedData.url) {
      try {
        new URL(validatedData.url);
      } catch {
        throw new ValidationError("Invalid URL for HTTP monitor");
      }
    } else if (validatedData.type === "tcp" && validatedData.url) {
      const parts = validatedData.url.replace("tcp://", "").split(":");
      if (parts.length !== 2 || isNaN(parseInt(parts[1]))) {
        throw new ValidationError("Invalid URL for TCP monitor. Expected format: host:port");
      }
    }

    // Update the monitor
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.url !== undefined) updateData.url = validatedData.url;
    if (validatedData.intervalSeconds !== undefined)
      updateData.intervalSeconds = validatedData.intervalSeconds;
    if (validatedData.timeoutMs !== undefined)
      updateData.timeoutMs = validatedData.timeoutMs;
    if (validatedData.expectedStatusCode !== undefined)
      updateData.expectedStatusCode = validatedData.expectedStatusCode;
    if (validatedData.headers !== undefined)
      updateData.headers = validatedData.headers;
    if (validatedData.failureThreshold !== undefined)
      updateData.failureThreshold = validatedData.failureThreshold;
    if (validatedData.isActive !== undefined)
      updateData.isActive = validatedData.isActive;

    const updateResult = await db
      .update(monitors)
      .set(updateData)
      .where(eq(monitors.id, monitorId))
      .returning();

    const updatedMonitor = updateResult[0];
    if (!updatedMonitor) {
      throw new Error("Failed to update monitor");
    }

    // Update schedule if interval or active status changed
    const intervalChanged =
      validatedData.intervalSeconds !== undefined &&
      validatedData.intervalSeconds !== existingMonitor.intervalSeconds;
    const activeChanged =
      validatedData.isActive !== undefined &&
      validatedData.isActive !== existingMonitor.isActive;

    if (intervalChanged || activeChanged) {
      await rescheduleMonitor(updatedMonitor);
    }

    return c.json({ monitor: updatedMonitor });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// DELETE /api/v1/admin/monitors/:id - Delete monitor
adminMonitors.delete("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const monitorId = c.req.param("id");

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

    // Remove from schedule
    await unscheduleMonitor(monitorId);

    // Delete the monitor (cascades to results)
    await db.delete(monitors).where(eq(monitors.id, monitorId));

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/monitors/:id/check - Trigger immediate check
adminMonitors.post("/:id/check", async (c) => {
  try {
    const orgId = c.get("organizationId")!;
    const monitorId = c.req.param("id");

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

    const monitor = existing.monitor;

    // Execute check immediately
    const result = await executeCheck(monitor);

    // Store the result
    await storeCheckResult(monitorId, result);

    return c.json({ result });
  } catch (error) {
    return errorResponse(c, error);
  }
});
