import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../lib/db";
import {
  components,
  componentStatusEnum,
  eq,
  and,
} from "@fyrendev/db";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  errorResponse,
} from "../../lib/errors";
import type { AuthContext } from "../../middleware/auth";

const adminComponents = new Hono<{ Variables: { auth: AuthContext } }>();

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
    const auth = c.get("auth");
    const status = c.req.query("status");

    let query = db
      .select()
      .from(components)
      .where(eq(components.organizationId, auth.organizationId))
      .$dynamic();

    if (status && componentStatuses.includes(status as any)) {
      query = query.where(
        and(
          eq(components.organizationId, auth.organizationId),
          eq(components.status, status as typeof componentStatuses[number])
        )
      );
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
    const auth = c.get("auth");
    const body = await c.req.json();
    const data = createComponentSchema.parse(body);

    const [comp] = await db
      .insert(components)
      .values({
        organizationId: auth.organizationId,
        name: data.name,
        description: data.description,
        status: data.status,
        displayOrder: data.displayOrder,
        isPublic: data.isPublic,
      })
      .returning();

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
    const auth = c.get("auth");
    const id = c.req.param("id");

    const [comp] = await db
      .select()
      .from(components)
      .where(
        and(
          eq(components.id, id),
          eq(components.organizationId, auth.organizationId)
        )
      )
      .limit(1);

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
    const auth = c.get("auth");
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateComponentSchema.parse(body);

    const [comp] = await db
      .update(components)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(components.id, id),
          eq(components.organizationId, auth.organizationId)
        )
      )
      .returning();

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

// PATCH /api/v1/admin/components/:id/status - Update component status
adminComponents.patch("/:id/status", async (c) => {
  try {
    const auth = c.get("auth");
    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateStatusSchema.parse(body);

    const [comp] = await db
      .update(components)
      .set({
        status: data.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(components.id, id),
          eq(components.organizationId, auth.organizationId)
        )
      )
      .returning();

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

// DELETE /api/v1/admin/components/:id - Delete component
adminComponents.delete("/:id", async (c) => {
  try {
    const auth = c.get("auth");
    const id = c.req.param("id");

    const [comp] = await db
      .delete(components)
      .where(
        and(
          eq(components.id, id),
          eq(components.organizationId, auth.organizationId)
        )
      )
      .returning();

    if (!comp) {
      throw new NotFoundError("Component not found");
    }

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminComponents };
