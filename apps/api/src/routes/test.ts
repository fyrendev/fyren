import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  db,
  sql,
  organizations,
  components,
  users,
  userOrganizations,
  incidents,
  incidentUpdates,
  incidentComponents,
} from "@fyrendev/db";
import { env } from "../env";

const testRoutes = new Hono();

// Only enable test routes in development/test environments
const isTestEnabled = env.NODE_ENV === "development" || env.NODE_ENV === "test";

/**
 * Reset all test data.
 * POST /api/v1/test/reset
 */
testRoutes.post("/reset", async (c) => {
  if (!isTestEnabled) {
    return c.json({ error: "Test routes not enabled" }, 403);
  }

  try {
    await db.execute(sql`
      TRUNCATE TABLE
        notification_logs,
        webhook_endpoints,
        subscribers,
        maintenance_components,
        maintenances,
        incident_components,
        incident_updates,
        incidents,
        incident_templates,
        monitor_results,
        monitors,
        components,
        api_keys,
        organization_invites,
        user_organizations,
        sessions,
        accounts,
        verifications,
        users,
        organizations
      RESTART IDENTITY CASCADE
    `);

    return c.json({ success: true });
  } catch (error) {
    console.error("Test reset failed:", error);
    return c.json({ error: "Reset failed" }, 500);
  }
});

const setupSchema = z.object({
  organization: z.object({
    name: z.string(),
    slug: z.string(),
  }),
  user: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string(),
  }),
  components: z
    .array(
      z.object({
        name: z.string(),
        status: z.enum([
          "operational",
          "degraded",
          "partial_outage",
          "major_outage",
          "maintenance",
        ]),
      })
    )
    .optional(),
  incidents: z
    .array(
      z.object({
        title: z.string(),
        status: z.enum(["investigating", "identified", "monitoring", "resolved"]),
        severity: z.enum(["minor", "major", "critical"]),
        message: z.string(),
      })
    )
    .optional(),
});

/**
 * Setup test data for E2E tests.
 * POST /api/v1/test/setup
 */
testRoutes.post("/setup", zValidator("json", setupSchema), async (c) => {
  if (!isTestEnabled) {
    return c.json({ error: "Test routes not enabled" }, 403);
  }

  const data = c.req.valid("json");

  try {
    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: data.organization.name,
        slug: data.organization.slug,
        timezone: "UTC",
      })
      .returning();

    // Create user using BetterAuth's API via HTTP to ensure proper password hashing
    // We need to call the auth endpoint directly since the internal API has issues with undefined values
    const signUpResponse = await fetch(
      `${env.BETTER_AUTH_URL}/api/auth/sign-up/email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.user.email,
          password: data.user.password,
          name: data.user.name,
        }),
      }
    );

    if (!signUpResponse.ok) {
      const errorBody = await signUpResponse.text();
      throw new Error(`Failed to create user: ${errorBody}`);
    }

    const signUpResult = await signUpResponse.json();
    const user = signUpResult.user;

    if (!user?.id) {
      throw new Error("Sign up did not return user ID");
    }

    // Create user-organization membership
    await db.insert(userOrganizations).values({
      userId: user.id,
      organizationId: org.id,
      role: "owner",
    });

    // Create components
    const createdComponents: Array<{ id: string; name: string }> = [];
    if (data.components) {
      for (let i = 0; i < data.components.length; i++) {
        const comp = data.components[i];
        const [created] = await db
          .insert(components)
          .values({
            organizationId: org.id,
            name: comp.name,
            status: comp.status,
            displayOrder: i,
            isPublic: true,
          })
          .returning();
        createdComponents.push({ id: created.id, name: created.name });
      }
    }

    // Create incidents
    if (data.incidents) {
      for (const inc of data.incidents) {
        const [incident] = await db
          .insert(incidents)
          .values({
            organizationId: org.id,
            title: inc.title,
            status: inc.status,
            severity: inc.severity,
            startedAt: new Date(),
          })
          .returning();

        // Add initial update
        await db.insert(incidentUpdates).values({
          incidentId: incident.id,
          status: inc.status,
          message: inc.message,
        });

        // Link to first component if available
        if (createdComponents.length > 0) {
          await db.insert(incidentComponents).values({
            incidentId: incident.id,
            componentId: createdComponents[0].id,
          });
        }
      }
    }

    return c.json({
      success: true,
      organization: { id: org.id, slug: org.slug },
      user: { id: user.id, email: user.email },
      components: createdComponents,
    });
  } catch (error) {
    console.error("Test setup failed:", error);
    return c.json({ error: "Setup failed", details: String(error) }, 500);
  }
});

export { testRoutes };
