import { Hono } from "hono";
import { db } from "../../lib/db";
import { organizations, components, eq, and, asc } from "@fyrendev/db";
import { NotFoundError, errorResponse } from "../../lib/errors";

const publicComponents = new Hono();

// Helper to get the organization
async function getOrganization() {
  const [org] = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.createdAt))
    .limit(1);
  if (!org) throw new NotFoundError("No organization configured");
  return org;
}

// GET /api/v1/org/components - Get public components for the organization
publicComponents.get("/components", async (c) => {
  try {
    const org = await getOrganization();

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
