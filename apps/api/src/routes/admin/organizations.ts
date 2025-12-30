import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../lib/db";
import { organizations, apiKeys, userOrganizations, eq } from "@fyrendev/db";
import { generateApiKey } from "../../lib/api-key";
import {
  NotFoundError,
  ForbiddenError,
  errorResponse,
} from "../../lib/errors";
import type { AuthContext } from "../../middleware/auth";
import type { AuthUser } from "../../lib/auth";

type Variables = {
  auth?: AuthContext;
  user?: AuthUser;
  authMethod?: "session" | "api_key" | null;
};

const adminOrganizations = new Hono<{ Variables: Variables }>();

// Slug validation: lowercase alphanumeric with hyphens, 3-50 chars
const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(slugRegex, "Slug must be lowercase alphanumeric with hyphens, 3-50 chars"),
  timezone: z.string().max(50).default("UTC"),
});

const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Brand color must be a valid hex color")
    .nullable()
    .optional(),
  timezone: z.string().max(50).optional(),
  customDomain: z.string().max(255).nullable().optional(),
});

// POST /organizations - Create organization
// If user is logged in, they become the owner. Otherwise, creates an org without owner (for bootstrap).
adminOrganizations.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const data = createOrganizationSchema.parse(body);
    const user = c.get("user");

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: data.name,
        slug: data.slug.toLowerCase(),
        timezone: data.timezone,
      })
      .returning();

    // If user is logged in, add them as owner
    if (user) {
      await db.insert(userOrganizations).values({
        userId: user.id,
        organizationId: org.id,
        role: "owner",
      });
    }

    // Generate API key for the new organization
    const apiKeyData = await generateApiKey();
    await db.insert(apiKeys).values({
      organizationId: org.id,
      name: "Default API Key",
      keyHash: apiKeyData.keyHash,
      keyPrefix: apiKeyData.keyPrefix,
    });

    return c.json(
      {
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          logoUrl: org.logoUrl,
          brandColor: org.brandColor,
          customDomain: org.customDomain,
          timezone: org.timezone,
          createdAt: org.createdAt.toISOString(),
          updatedAt: org.updatedAt.toISOString(),
        },
        apiKey: apiKeyData.key, // Only returned on creation
      },
      201
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /organizations/:id - Get organization by ID (auth required)
adminOrganizations.get("/:id", async (c) => {
  try {
    const auth = c.get("auth");
    if (!auth) {
      throw new ForbiddenError("Authentication required");
    }
    const id = c.req.param("id");

    // Verify the user has access to this organization
    if (auth.organizationId !== id) {
      throw new ForbiddenError("You don't have access to this organization");
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        brandColor: org.brandColor,
        customDomain: org.customDomain,
        timezone: org.timezone,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /organizations/:id - Update organization (auth required)
adminOrganizations.put("/:id", async (c) => {
  try {
    const auth = c.get("auth");
    if (!auth) {
      throw new ForbiddenError("Authentication required");
    }
    const id = c.req.param("id");

    // Verify the user has access to this organization
    if (auth.organizationId !== id) {
      throw new ForbiddenError("You don't have access to this organization");
    }

    const body = await c.req.json();
    const data = updateOrganizationSchema.parse(body);

    const [org] = await db
      .update(organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        brandColor: org.brandColor,
        customDomain: org.customDomain,
        timezone: org.timezone,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminOrganizations };
