import { Hono } from "hono";
import { getOrganization } from "../../lib/organization";
import { errorResponse } from "../../lib/errors";

const publicOrganizations = new Hono();

// GET /api/v1/org/default - Get the organization for this instance
publicOrganizations.get("/default", async (c) => {
  try {
    const org = await getOrganization();

    return c.json({
      organization: {
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        brandColor: org.brandColor,
        accentColor: org.accentColor,
        backgroundColor: org.backgroundColor,
        textColor: org.textColor,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { publicOrganizations };
