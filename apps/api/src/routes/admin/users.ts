import { db, eq, organizations, userOrganizations, users } from "@fyrendev/db";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthUser } from "../../lib/auth";
import { errorResponse, NotFoundError } from "../../lib/errors";
import { requireSession } from "../../middleware/session";

type Variables = {
  user: AuthUser;
};

const adminUsers = new Hono<{ Variables: Variables }>();

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// GET /api/v1/admin/me - Get current user info with organizations
adminUsers.get("/me", requireSession, async (c) => {
  try {
    const user = c.get("user");

    // Get user's organizations with roles
    const memberships = await db
      .select({
        membership: userOrganizations,
        organization: organizations,
      })
      .from(userOrganizations)
      .innerJoin(organizations, eq(userOrganizations.organizationId, organizations.id))
      .where(eq(userOrganizations.userId, user.id));

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image,
        createdAt: user.createdAt,
      },
      organizations: memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.membership.role,
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/me - Update current user
adminUsers.put("/me", requireSession, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = updateUserSchema.parse(body);

    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updatedUser) {
      throw new NotFoundError("User not found");
    }

    return c.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        emailVerified: updatedUser.emailVerified,
        image: updatedUser.image,
        createdAt: updatedUser.createdAt.toISOString(),
        updatedAt: updatedUser.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminUsers };
