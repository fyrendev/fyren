import { db, eq, users } from "@fyrendev/db";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthUser } from "../../lib/auth";
import { errorResponse, NotFoundError } from "../../lib/errors";
import { requireSession } from "../../middleware/session";
import { getOrganization } from "../../lib/organization";

type Variables = {
  user: AuthUser;
};

const adminUsers = new Hono<{ Variables: Variables }>();

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
});

// GET /api/v1/admin/me - Get current user info with organization
adminUsers.get("/me", requireSession, async (c) => {
  try {
    const user = c.get("user");

    // Get the singleton organization
    let organization = null;
    try {
      const org = await getOrganization();
      organization = {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: user.role,
      };
    } catch {
      // No organization configured yet
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        createdAt: user.createdAt,
      },
      organization,
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
