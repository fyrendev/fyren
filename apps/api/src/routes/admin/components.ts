import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../lib/db";
import { components, componentStatusEnum, monitors, eq } from "@fyrendev/db";
import { NotFoundError, errorResponse } from "../../lib/errors";
import { createAuditLogger } from "../../lib/logging/audit";
import { unscheduleMonitor } from "../../lib/queue";

const adminComponents = new Hono();

const componentStatuses = componentStatusEnum.enumValues;

const createComponentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  status: z.enum(componentStatuses).default("operational"),
  displayOrder: z.number().int().min(0).default(0),
  isPublic: z.boolean().default(true),
});

const updateComponentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isPublic: z.boolean().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(componentStatuses),
});

// GET /api/v1/admin/components - List all components
adminComponents.get("/", async (c) => {
  try {
    const status = c.req.query("status");

    let query = db.select().from(components).$dynamic();

    if (status && componentStatuses.includes(status as (typeof componentStatuses)[number])) {
      query = query.where(eq(components.status, status as (typeof componentStatuses)[number]));
    }

    const result = await query.orderBy(components.displayOrder);

    return c.json({
      components: result.map((comp) => ({
        id: comp.id,
        name: comp.name,
        description: comp.description,
        status: comp.status,
        displayOrder: comp.displayOrder,
        isPublic: comp.isPublic,
        createdAt: comp.createdAt.toISOString(),
        updatedAt: comp.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/components - Create component
adminComponents.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = createComponentSchema.parse(body);

    const [comp] = await db
      .insert(components)
      .values({
        name: data.name,
        description: data.description,
        status: data.status,
        displayOrder: data.displayOrder,
        isPublic: data.isPublic,
      })
      .returning();

    if (!comp) {
      throw new Error("Failed to create component");
    }

    // Audit log
    const user = c.get("user");
    const auditLogger = createAuditLogger({
      userId: user?.id,
      requestId: c.get("requestId"),
    });
    auditLogger.componentCreated(comp.id, { name: comp.name });

    return c.json(
      {
        component: {
          id: comp.id,
          name: comp.name,
          description: comp.description,
          status: comp.status,
          displayOrder: comp.displayOrder,
          isPublic: comp.isPublic,
          createdAt: comp.createdAt.toISOString(),
          updatedAt: comp.updatedAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/admin/components/:id - Get component by ID
adminComponents.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const [comp] = await db.select().from(components).where(eq(components.id, id)).limit(1);

    if (!comp) {
      throw new NotFoundError("Component not found");
    }

    return c.json({
      component: {
        id: comp.id,
        name: comp.name,
        description: comp.description,
        status: comp.status,
        displayOrder: comp.displayOrder,
        isPublic: comp.isPublic,
        createdAt: comp.createdAt.toISOString(),
        updatedAt: comp.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/components/:id - Update component
adminComponents.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateComponentSchema.parse(body);

    const [comp] = await db
      .update(components)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(components.id, id))
      .returning();

    if (!comp) {
      throw new NotFoundError("Component not found");
    }

    // Audit log
    const user = c.get("user");
    const auditLogger = createAuditLogger({
      userId: user?.id,
      requestId: c.get("requestId"),
    });
    auditLogger.componentUpdated(id, data);

    return c.json({
      component: {
        id: comp.id,
        name: comp.name,
        description: comp.description,
        status: comp.status,
        displayOrder: comp.displayOrder,
        isPublic: comp.isPublic,
        createdAt: comp.createdAt.toISOString(),
        updatedAt: comp.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PATCH /api/v1/admin/components/:id/status - Update component status
adminComponents.patch("/:id/status", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateStatusSchema.parse(body);

    const [comp] = await db
      .update(components)
      .set({
        status: data.status,
        updatedAt: new Date(),
      })
      .where(eq(components.id, id))
      .returning();

    if (!comp) {
      throw new NotFoundError("Component not found");
    }

    // Audit log
    const user = c.get("user");
    const auditLogger = createAuditLogger({
      userId: user?.id,
      requestId: c.get("requestId"),
    });
    auditLogger.componentStatusChanged(id, { from: "unknown", to: data.status });

    return c.json({
      component: {
        id: comp.id,
        name: comp.name,
        description: comp.description,
        status: comp.status,
        displayOrder: comp.displayOrder,
        isPublic: comp.isPublic,
        createdAt: comp.createdAt.toISOString(),
        updatedAt: comp.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// DELETE /api/v1/admin/components/:id - Delete component
adminComponents.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");

    // Unschedule all monitors for this component before cascade delete removes them
    const componentMonitors = await db
      .select({ id: monitors.id })
      .from(monitors)
      .where(eq(monitors.componentId, id));

    await Promise.all(componentMonitors.map((m) => unscheduleMonitor(m.id)));

    const [comp] = await db.delete(components).where(eq(components.id, id)).returning();

    if (!comp) {
      throw new NotFoundError("Component not found");
    }

    // Audit log
    const user = c.get("user");
    const auditLogger = createAuditLogger({
      userId: user?.id,
      requestId: c.get("requestId"),
    });
    auditLogger.componentDeleted(id);

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminComponents };
