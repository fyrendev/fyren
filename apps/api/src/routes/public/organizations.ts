import { Hono } from "hono";
import { db } from "../../lib/db";
import { organizations, asc } from "@fyrendev/db";
import { NotFoundError, errorResponse } from "../../lib/errors";

const publicOrganizations = new Hono();

// GET /api/v1/org/default - Get the organization for this instance
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

export { publicOrganizations };
