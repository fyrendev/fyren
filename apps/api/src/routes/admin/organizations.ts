import { apiKeys, eq, organizations, users } from "@fyrendev/db";
import { Hono } from "hono";
import { z } from "zod";
import { generateApiKey } from "../../lib/api-key";
import type { AuthUser } from "../../lib/auth";
import { db } from "../../lib/db";
import { clearProviderCache, getEmailProvider } from "../../lib/email";
import { encryptJson, isEncryptionAvailable } from "../../lib/encryption";
import { BadRequestError, errorResponse, NotFoundError } from "../../lib/errors";
import { sanitizeCustomCss, sanitizeTwitterHandle } from "../../lib/sanitize";
import { createAuditLogger } from "../../lib/logging/audit";
import { getOrganization } from "../../lib/organization";
import { requireRole } from "../../middleware/session";

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
    backgroundColor: org.backgroundColor,
    textColor: org.textColor,
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
    // Email Configuration (never expose encrypted credentials)
    emailProvider: org.emailProvider,
    emailFromAddress: org.emailFromAddress,
    emailConfigured: !!org.emailConfig, // Just indicate if configured, not the actual config
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

// Email provider configuration schemas
const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().min(1).max(65535),
  user: z.string().optional(),
  password: z.string().optional(),
  secure: z.boolean().default(true),
});

const sendgridConfigSchema = z.object({
  apiKey: z.string().min(1),
});

const sesConfigSchema = z.object({
  region: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
});

z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("console") }),
  z.object({ provider: z.literal("smtp"), config: smtpConfigSchema }),
  z.object({ provider: z.literal("sendgrid"), config: sendgridConfigSchema }),
  z.object({ provider: z.literal("ses"), config: sesConfigSchema }),
]);

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
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Background color must be a valid hex color")
    .nullable()
    .optional(),
  textColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Text color must be a valid hex color")
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

  // Email Configuration
  emailProvider: z.enum(["console", "smtp", "sendgrid", "ses"]).optional(),
  emailFromAddress: z.string().email().max(255).nullable().optional(),
  emailConfig: z
    .union([smtpConfigSchema, sendgridConfigSchema, sesConfigSchema])
    .nullable()
    .optional(),
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

    // If user is logged in, set them as owner
    if (user) {
      await db.update(users).set({ role: "owner" }).where(eq(users.id, user.id));
    }

    // Generate API key for the new organization
    const apiKeyData = await generateApiKey();
    await db.insert(apiKeys).values({
      name: "Default API Key",
      keyHash: apiKeyData.keyHash,
      keyPrefix: apiKeyData.keyPrefix,
    });

    // Audit log
    const auditLogger = createAuditLogger({
      userId: user?.id,
      organizationId: org.id,
      requestId: c.get("requestId"),
    });
    auditLogger.orgCreated(org.id, { name: org.name, slug: org.slug });

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

// GET /organizations - Get current organization (auth required)
adminOrganizations.get("/", requireRole("owner", "admin", "member"), async (c) => {
  try {
    const org = await getOrganization();

    return c.json({
      organization: serializeOrganization(org),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /organizations - Update current organization (auth required)
adminOrganizations.put("/", requireRole("owner", "admin"), async (c) => {
  try {
    const org = await getOrganization();

    const body = await c.req.json();
    const data = updateOrganizationSchema.parse(body);

    // Handle email config encryption
    let encryptedEmailConfig: string | null | undefined = undefined;
    if (data.emailConfig !== undefined) {
      if (data.emailConfig === null) {
        encryptedEmailConfig = null;
      } else {
        // Require encryption key for storing email credentials
        if (!isEncryptionAvailable()) {
          throw new BadRequestError(
            "Email configuration requires ENCRYPTION_KEY environment variable to be set"
          );
        }
        encryptedEmailConfig = encryptJson(data.emailConfig);
      }
    }

    // Sanitize and prepare data for update
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
      // Replace emailConfig with encrypted version
      emailConfig: encryptedEmailConfig,
    };

    const [updatedOrg] = await db
      .update(organizations)
      .set({
        ...sanitizedData,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, org.id))
      .returning();

    if (!updatedOrg) {
      throw new NotFoundError("Organization not found");
    }

    // Clear cached email provider if email settings changed
    if (
      data.emailProvider !== undefined ||
      data.emailFromAddress !== undefined ||
      data.emailConfig !== undefined
    ) {
      clearProviderCache();
    }

    // Audit log
    const user = c.get("user") as AuthUser | undefined;
    const auditLogger = createAuditLogger({
      userId: user?.id,
      organizationId: org.id,
      requestId: c.get("requestId"),
    });
    auditLogger.orgUpdated(org.id, data);

    return c.json({
      organization: serializeOrganization(updatedOrg),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /organizations/test-email - Send test email (auth required)
adminOrganizations.post("/test-email", requireRole("owner", "admin"), async (c) => {
  try {
    // Get the current user's email
    const user = c.get("user") as AuthUser | undefined;
    if (!user?.email) {
      throw new BadRequestError("No email address found for current user");
    }

    // Get email provider for this instance
    const provider = await getEmailProvider();

    // Send test email
    await provider.send({
      to: user.email,
      subject: "Test Email from Fyren",
      html: `
        <h1>Email Configuration Test</h1>
        <p>This is a test email to verify your email configuration is working correctly.</p>
        <p>If you received this email, your email provider is configured properly.</p>
        <p><em>Sent from Fyren</em></p>
      `,
    });

    return c.json({ success: true, message: `Test email sent to ${user.email}` });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminOrganizations };
