import { Hono } from "hono";
import { z } from "zod";
import { db, monitors, components, monitorResults, eq, desc } from "@fyrendev/db";
import { NotFoundError, ValidationError, errorResponse } from "../../lib/errors";
import { scheduleMonitor, unscheduleMonitor, rescheduleMonitor } from "../../lib/queue";
import { executeCheck } from "../../lib/checkers";
import { parseNatsUrl } from "../../lib/checkers/nats";
import { storeCheckResult } from "../../services/monitor.service";
import { validateExternalUrl } from "../../lib/url-validator";

export const adminMonitors = new Hono();

// Validation schemas
const createMonitorSchema = z.object({
  componentId: z.string().uuid(),
  type: z.enum(["http", "tcp", "ssl_expiry", "nats"]),
  url: z.string().min(1).max(2000),
  intervalSeconds: z.number().int().min(30).max(3600).default(60),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  expectedStatusCode: z.number().int().min(100).max(599).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  failureThreshold: z.number().int().min(1).max(10).default(3),
  isActive: z.boolean().default(true),
  // Auto-incident settings
  createIncidentOnFailure: z.boolean().default(false),
  autoResolveIncident: z.boolean().default(true),
  // Test connection before creating
  testConnection: z.boolean().default(false),
});

const updateMonitorSchema = z.object({
  componentId: z.string().uuid().optional(),
  type: z.enum(["http", "tcp", "ssl_expiry", "nats"]).optional(),
  url: z.string().min(1).max(2000).optional(),
  intervalSeconds: z.number().int().min(30).max(3600).optional(),
  timeoutMs: z.number().int().min(1000).max(30000).optional(),
  expectedStatusCode: z.number().int().min(100).max(599).nullable().optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  failureThreshold: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  // Auto-incident settings
  createIncidentOnFailure: z.boolean().optional(),
  autoResolveIncident: z.boolean().optional(),
});

// GET /api/v1/admin/monitors - List monitors
adminMonitors.get("/", async (c) => {
  try {
    const componentId = c.req.query("componentId");
    const type = c.req.query("type") as "http" | "tcp" | "ssl_expiry" | "nats" | undefined;
    const isActive = c.req.query("isActive");

    // Build query with joins
    const query = db
      .select({
        monitor: monitors,
        component: {
          id: components.id,
          name: components.name,
        },
      })
      .from(monitors)
      .innerJoin(components, eq(monitors.componentId, components.id));

    // Apply filters
    const allMonitors = await query.orderBy(desc(monitors.createdAt));

    // Filter in application if needed
    let filteredMonitors = allMonitors;

    if (componentId) {
      filteredMonitors = filteredMonitors.filter((m) => m.monitor.componentId === componentId);
    }

    if (type) {
      filteredMonitors = filteredMonitors.filter((m) => m.monitor.type === type);
    }

    if (isActive !== undefined) {
      const isActiveValue = isActive === "true";
      filteredMonitors = filteredMonitors.filter((m) => m.monitor.isActive === isActiveValue);
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
    const body = await c.req.json();

    const validatedData = createMonitorSchema.parse(body);

    // Verify component exists
    const [component] = await db
      .select()
      .from(components)
      .where(eq(components.id, validatedData.componentId))
      .limit(1);

    if (!component) {
      throw new NotFoundError("Component not found");
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
      const port = parts[1];
      if (parts.length !== 2 || !port || isNaN(parseInt(port))) {
        throw new ValidationError("Invalid URL for TCP monitor. Expected format: host:port");
      }
    } else if (validatedData.type === "nats") {
      if (!parseNatsUrl(validatedData.url)) {
        throw new ValidationError(
          "Invalid URL for NATS monitor. Expected format: nats://host:port or host:port"
        );
      }
    }

    // SSRF protection: validate URL doesn't resolve to private/internal IPs
    const urlValidation = await validateExternalUrl(validatedData.url);
    if (!urlValidation.valid) {
      throw new ValidationError(`Invalid monitor URL: ${urlValidation.error}`);
    }

    // Test connection before creating if requested
    if (validatedData.testConnection) {
      const testMonitor = {
        id: "test",
        componentId: validatedData.componentId,
        type: validatedData.type,
        url: validatedData.url,
        timeoutMs: validatedData.timeoutMs,
        intervalSeconds: validatedData.intervalSeconds,
        expectedStatusCode:
          validatedData.type === "http" ? (validatedData.expectedStatusCode ?? 200) : null,
        headers:
          validatedData.type === "http" || validatedData.type === "nats"
            ? (validatedData.headers ?? null)
            : null,
        failureThreshold: validatedData.failureThreshold,
        isActive: true,
        lastCheckedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createIncidentOnFailure: false,
        autoResolveIncident: false,
      };

      const testResult = await executeCheck(testMonitor);
      if (testResult.status === "down") {
        throw new ValidationError(
          `Connection test failed: ${testResult.errorMessage || "Unable to connect"}`
        );
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
          validatedData.type === "http" ? (validatedData.expectedStatusCode ?? 200) : null,
        headers:
          validatedData.type === "http" || validatedData.type === "nats"
            ? (validatedData.headers ?? null)
            : null,
        failureThreshold: validatedData.failureThreshold,
        isActive: validatedData.isActive,
        createIncidentOnFailure: validatedData.createIncidentOnFailure,
        autoResolveIncident: validatedData.autoResolveIncident,
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

// Validation schema for test connection (same as create but without componentId requirement)
const testConnectionSchema = z.object({
  type: z.enum(["http", "tcp", "ssl_expiry", "nats"]),
  url: z.string().min(1).max(2000),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  expectedStatusCode: z.number().int().min(100).max(599).optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

// POST /api/v1/admin/monitors/test - Test connection without creating monitor
adminMonitors.post("/test", async (c) => {
  try {
    const body = await c.req.json();
    const validatedData = testConnectionSchema.parse(body);

    // Type-specific validation
    if (validatedData.type === "http") {
      try {
        new URL(validatedData.url);
      } catch {
        throw new ValidationError("Invalid URL for HTTP monitor");
      }
    } else if (validatedData.type === "tcp") {
      const parts = validatedData.url.replace("tcp://", "").split(":");
      const port = parts[1];
      if (parts.length !== 2 || !port || isNaN(parseInt(port))) {
        throw new ValidationError("Invalid URL for TCP monitor. Expected format: host:port");
      }
    } else if (validatedData.type === "nats") {
      if (!parseNatsUrl(validatedData.url)) {
        throw new ValidationError(
          "Invalid URL for NATS monitor. Expected format: nats://host:port or host:port"
        );
      }
    }

    // SSRF protection: validate URL doesn't resolve to private/internal IPs
    const urlValidation = await validateExternalUrl(validatedData.url);
    if (!urlValidation.valid) {
      throw new ValidationError(`Invalid monitor URL: ${urlValidation.error}`);
    }

    // Create a temporary monitor object for testing
    const testMonitor = {
      id: "test",
      componentId: "test",
      type: validatedData.type,
      url: validatedData.url,
      timeoutMs: validatedData.timeoutMs,
      intervalSeconds: 60,
      expectedStatusCode:
        validatedData.type === "http" ? (validatedData.expectedStatusCode ?? 200) : null,
      headers:
        validatedData.type === "http" || validatedData.type === "nats"
          ? (validatedData.headers ?? null)
          : null,
      failureThreshold: 1,
      isActive: true,
      lastCheckedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createIncidentOnFailure: false,
      autoResolveIncident: false,
    };

    // Execute the check
    const result = await executeCheck(testMonitor);

    return c.json({
      success: result.status === "up",
      result: {
        status: result.status,
        responseTimeMs: result.responseTimeMs,
        errorMessage: result.errorMessage,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/admin/monitors/:id - Get monitor with recent results
adminMonitors.get("/:id", async (c) => {
  try {
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
      .where(eq(monitors.id, monitorId))
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
    const monitorId = c.req.param("id");
    const body = await c.req.json();

    const validatedData = updateMonitorSchema.parse(body);

    // Verify monitor exists
    const [existingMonitor] = await db
      .select()
      .from(monitors)
      .where(eq(monitors.id, monitorId))
      .limit(1);

    if (!existingMonitor) {
      throw new NotFoundError("Monitor not found");
    }

    // Verify new component exists if changing
    if (validatedData.componentId !== undefined) {
      const [component] = await db
        .select()
        .from(components)
        .where(eq(components.id, validatedData.componentId))
        .limit(1);

      if (!component) {
        throw new NotFoundError("Component not found");
      }
    }

    // Type-specific validation
    if (validatedData.type === "http" && validatedData.url) {
      try {
        new URL(validatedData.url);
      } catch {
        throw new ValidationError("Invalid URL for HTTP monitor");
      }
    } else if (validatedData.type === "tcp" && validatedData.url) {
      const parts = validatedData.url.replace("tcp://", "").split(":");
      const port = parts[1];
      if (parts.length !== 2 || !port || isNaN(parseInt(port))) {
        throw new ValidationError("Invalid URL for TCP monitor. Expected format: host:port");
      }
    } else if (validatedData.type === "nats" && validatedData.url) {
      if (!parseNatsUrl(validatedData.url)) {
        throw new ValidationError(
          "Invalid URL for NATS monitor. Expected format: nats://host:port or host:port"
        );
      }
    }

    // SSRF protection: validate new URL if changed
    if (validatedData.url !== undefined && validatedData.url !== existingMonitor.url) {
      const urlValidation = await validateExternalUrl(validatedData.url);
      if (!urlValidation.valid) {
        throw new ValidationError(`Invalid monitor URL: ${urlValidation.error}`);
      }
    }

    // Update the monitor
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validatedData.componentId !== undefined) updateData.componentId = validatedData.componentId;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.url !== undefined) updateData.url = validatedData.url;
    if (validatedData.intervalSeconds !== undefined)
      updateData.intervalSeconds = validatedData.intervalSeconds;
    if (validatedData.timeoutMs !== undefined) updateData.timeoutMs = validatedData.timeoutMs;
    if (validatedData.expectedStatusCode !== undefined)
      updateData.expectedStatusCode = validatedData.expectedStatusCode;
    if (validatedData.headers !== undefined) updateData.headers = validatedData.headers;
    if (validatedData.failureThreshold !== undefined)
      updateData.failureThreshold = validatedData.failureThreshold;
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.createIncidentOnFailure !== undefined)
      updateData.createIncidentOnFailure = validatedData.createIncidentOnFailure;
    if (validatedData.autoResolveIncident !== undefined)
      updateData.autoResolveIncident = validatedData.autoResolveIncident;

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
      validatedData.isActive !== undefined && validatedData.isActive !== existingMonitor.isActive;

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
    const monitorId = c.req.param("id");

    // Verify monitor exists
    const [existing] = await db.select().from(monitors).where(eq(monitors.id, monitorId)).limit(1);

    if (!existing) {
      throw new NotFoundError("Monitor not found");
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

// PATCH /api/v1/admin/monitors/:id/toggle - Toggle monitor active state
adminMonitors.patch("/:id/toggle", async (c) => {
  try {
    const monitorId = c.req.param("id");

    // Verify monitor exists
    const [existing] = await db.select().from(monitors).where(eq(monitors.id, monitorId)).limit(1);

    if (!existing) {
      throw new NotFoundError("Monitor not found");
    }

    const newIsActive = !existing.isActive;

    // Update the monitor
    const [updatedMonitor] = await db
      .update(monitors)
      .set({
        isActive: newIsActive,
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, monitorId))
      .returning();

    if (!updatedMonitor) {
      throw new Error("Failed to update monitor");
    }

    // Update schedule
    await rescheduleMonitor(updatedMonitor);

    return c.json({ monitor: updatedMonitor });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/monitors/:id/check - Trigger immediate check
adminMonitors.post("/:id/check", async (c) => {
  try {
    const monitorId = c.req.param("id");

    // Verify monitor exists
    const [existing] = await db.select().from(monitors).where(eq(monitors.id, monitorId)).limit(1);

    if (!existing) {
      throw new NotFoundError("Monitor not found");
    }

    // Execute check immediately
    const result = await executeCheck(existing);

    // Store the result
    await storeCheckResult(monitorId, result);

    return c.json({ result });
  } catch (error) {
    return errorResponse(c, error);
  }
});
