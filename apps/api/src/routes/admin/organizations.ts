import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../lib/db";
import { organizations, apiKeys, userOrganizations, eq } from "@fyrendev/db";
import { generateApiKey } from "../../lib/api-key";
import { NotFoundError, ForbiddenError, errorResponse } from "../../lib/errors";
import { sanitizeCustomCss, sanitizeTwitterHandle } from "../../lib/sanitize";

const adminOrganizations = new Hono();

// Slug validation: lowercase alphanumeric with hyphens, 3-50 chars
const slugRegex = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

// Helper function to serialize organization for API response
function serializeOrganization(org: typeof organizations.$inferSelect) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    // Branding - Logos
    logoUrl: org.logoUrl,
    logoLightUrl: org.logoLightUrl,
    faviconUrl: org.faviconUrl,
    // Branding - Colors
    brandColor: org.brandColor,
    accentColor: org.accentColor,
    // Branding - Custom CSS
    customCss: org.customCss,
    // Custom domain
    customDomain: org.customDomain,
    customDomainVerified: org.customDomainVerified,
    // SEO / Meta
    metaTitle: org.metaTitle,
    metaDescription: org.metaDescription,
    // Social / Support
    twitterHandle: org.twitterHandle,
    supportUrl: org.supportUrl,
    // Settings
    timezone: org.timezone,
    // Timestamps
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

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
  // Basic info
  name: z.string().min(1).max(255).optional(),

  // Branding - Logos
  logoUrl: z.string().url().max(500).nullable().optional(),
  logoLightUrl: z.string().url().max(500).nullable().optional(),
  faviconUrl: z.string().url().max(500).nullable().optional(),

  // Branding - Colors
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Brand color must be a valid hex color")
    .nullable()
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Accent color must be a valid hex color")
    .nullable()
    .optional(),

  // Branding - Custom CSS
  customCss: z.string().max(50000).nullable().optional(),

  // Custom domain
  customDomain: z.string().max(255).nullable().optional(),

  // SEO / Meta
  metaTitle: z.string().max(100).nullable().optional(),
  metaDescription: z.string().max(255).nullable().optional(),

  // Social / Support
  twitterHandle: z.string().max(50).nullable().optional(),
  supportUrl: z.string().url().max(500).nullable().optional(),

  // Settings
  timezone: z.string().max(50).optional(),
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

    if (!org) {
      throw new Error("Failed to create organization");
    }

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
        organization: serializeOrganization(org),
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
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }
    const id = c.req.param("id");

    // Verify the user has access to this organization
    if (orgId !== id) {
      throw new ForbiddenError("You don't have access to this organization");
    }

    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    return c.json({
      organization: serializeOrganization(org),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /organizations/:id - Update organization (auth required)
adminOrganizations.put("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }
    const id = c.req.param("id");

    // Verify the user has access to this organization
    if (orgId !== id) {
      throw new ForbiddenError("You don't have access to this organization");
    }

    const body = await c.req.json();
    const data = updateOrganizationSchema.parse(body);

    // Sanitize custom CSS if provided
    const sanitizedData = {
      ...data,
      // Sanitize custom CSS to prevent XSS
      customCss:
        data.customCss !== undefined
          ? data.customCss
            ? sanitizeCustomCss(data.customCss)
            : null
          : undefined,
      // Sanitize Twitter handle
      twitterHandle:
        data.twitterHandle !== undefined
          ? data.twitterHandle
            ? sanitizeTwitterHandle(data.twitterHandle)
            : null
          : undefined,
    };

    const [org] = await db
      .update(organizations)
      .set({
        ...sanitizedData,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning();

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

    return c.json({
      organization: serializeOrganization(org),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminOrganizations };
