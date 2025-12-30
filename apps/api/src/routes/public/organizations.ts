import { Hono } from "hono";
import { db } from "../../lib/db";
import { organizations, eq } from "@fyrendev/db";
import { NotFoundError, errorResponse } from "../../lib/errors";

const publicOrganizations = new Hono();

// GET /api/v1/org/:slug - Get public organization info
publicOrganizations.get("/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");

    const [org] = await db
      .select({
        name: organizations.name,
        slug: organizations.slug,
        logoUrl: organizations.logoUrl,
        brandColor: organizations.brandColor,
      })
      .from(organizations)
      .where(eq(organizations.slug, slug.toLowerCase()))
      .limit(1);

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    return c.json({
      organization: org,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { publicOrganizations };
