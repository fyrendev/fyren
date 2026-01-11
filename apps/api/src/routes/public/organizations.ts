import { Hono } from "hono";
import { db } from "../../lib/db";
import { organizations, eq, asc } from "@fyrendev/db";
import { NotFoundError, errorResponse } from "../../lib/errors";

const publicOrganizations = new Hono();

// GET /api/v1/org/default - Get the default (first) organization
// This endpoint must be defined before /:slug to avoid being captured by it
publicOrganizations.get("/default", async (c) => {
  try {
    const [org] = await db
      .select({
        name: organizations.name,
        slug: organizations.slug,
        logoUrl: organizations.logoUrl,
        brandColor: organizations.brandColor,
        accentColor: organizations.accentColor,
        backgroundColor: organizations.backgroundColor,
        textColor: organizations.textColor,
      })
      .from(organizations)
      .orderBy(asc(organizations.createdAt))
      .limit(1);

    if (!org) {
      throw new NotFoundError("No organization found");
    }

    return c.json({
      organization: org,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

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
        accentColor: organizations.accentColor,
        backgroundColor: organizations.backgroundColor,
        textColor: organizations.textColor,
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
