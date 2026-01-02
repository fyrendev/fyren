import { Hono } from "hono";
import { db } from "../../lib/db";
import { organizations, components, eq, and, asc } from "@fyrendev/db";
import { NotFoundError, errorResponse } from "../../lib/errors";

const publicComponents = new Hono();

// GET /api/v1/org/:slug/components - Get public components for an organization
publicComponents.get("/:slug/components", async (c) => {
  try {
    const slug = c.req.param("slug");

    // First, find the organization
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug.toLowerCase()))
      .limit(1);

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

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
      .where(and(eq(components.organizationId, org.id), eq(components.isPublic, true)))
      .orderBy(asc(components.displayOrder));

    return c.json({
      components: result,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { publicComponents };
