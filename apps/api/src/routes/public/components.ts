import { Hono } from "hono";
import { db } from "../../lib/db";
import { components, eq, asc } from "@fyrendev/db";
import { errorResponse } from "../../lib/errors";

const publicComponents = new Hono();

// GET /api/v1/org/components - Get public components for the organization
publicComponents.get("/components", async (c) => {
  try {
    // Get public components
    const result = await db
      .select({
        id: components.id,
        name: components.name,
        description: components.description,
        status: components.status,
        displayOrder: components.displayOrder,
      })
      .from(components)
      .where(eq(components.isPublic, true))
      .orderBy(asc(components.displayOrder));

    return c.json({
      components: result,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { publicComponents };
