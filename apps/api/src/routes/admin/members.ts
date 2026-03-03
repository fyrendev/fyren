import { Hono } from "hono";
import { z } from "zod";
import { db, users, eq, isNotNull } from "@fyrendev/db";
import { authMiddleware } from "../../middleware/auth";
import { requireRole } from "../../middleware/session";
import { errorResponse, NotFoundError, ForbiddenError, BadRequestError } from "../../lib/errors";
import type { AuthUser } from "../../lib/auth";

type Variables = {
  user?: AuthUser;
  authMethod?: "session" | "api_key" | null;
};

const adminMembers = new Hono<{ Variables: Variables }>();

const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]), // Can't promote to owner via this endpoint
});

// GET /api/v1/admin/members - List org members
adminMembers.get("/members", authMiddleware, requireRole("owner", "admin", "member"), async (c) => {
  try {
    const members = await db.select().from(users).where(isNotNull(users.role));

    return c.json({
      members: members.map((m) => ({
        id: m.id,
        user: {
          id: m.id,
          email: m.email,
          name: m.name,
          image: m.image,
        },
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/members/:id - Update member role
adminMembers.put("/members/:id", authMiddleware, requireRole("owner", "admin"), async (c) => {
  try {
    const userId = c.req.param("id");
    const currentUser = c.get("user");
    const body = await c.req.json();
    const data = updateMemberSchema.parse(body);

    // Get the user to update
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!targetUser || !targetUser.role) {
      throw new NotFoundError("Member not found");
    }

    // Cannot change owner's role
    if (targetUser.role === "owner") {
      throw new ForbiddenError("Cannot change owner's role. Transfer ownership instead.");
    }

    // Admins can only change members, not other admins
    if (currentUser?.role === "admin" && targetUser.role === "admin") {
      throw new ForbiddenError("Admins cannot modify other admins");
    }

    const [updated] = await db
      .update(users)
      .set({
        role: data.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw new Error("Failed to update member");
    }

    return c.json({
      member: {
        id: updated.id,
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          image: updated.image,
        },
        role: updated.role,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// DELETE /api/v1/admin/members/:id - Remove member
adminMembers.delete("/members/:id", authMiddleware, requireRole("owner", "admin"), async (c) => {
  try {
    const userId = c.req.param("id");
    const currentUser = c.get("user");

    // Get the user to delete
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!targetUser || !targetUser.role) {
      throw new NotFoundError("Member not found");
    }

    // Cannot remove owner
    if (targetUser.role === "owner") {
      throw new ForbiddenError("Cannot remove owner. Transfer ownership first.");
    }

    // Cannot remove yourself (use leave endpoint)
    if (currentUser && targetUser.id === currentUser.id) {
      throw new BadRequestError("Cannot remove yourself. Use the leave endpoint.");
    }

    // Admins can only remove members, not other admins
    if (currentUser?.role === "admin" && targetUser.role === "admin") {
      throw new ForbiddenError("Admins cannot remove other admins");
    }

    // Remove user from organization by nulling their role (preserves BetterAuth account)
    await db.update(users).set({ role: null, updatedAt: new Date() }).where(eq(users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/leave - Leave organization (deletes own account)
adminMembers.post("/leave", authMiddleware, requireRole("owner", "admin", "member"), async (c) => {
  try {
    const user = c.get("user");
    const authMethod = c.get("authMethod");

    // API key auth cannot leave org
    if (authMethod === "api_key") {
      throw new ForbiddenError("Cannot leave organization via API key");
    }

    if (!user) {
      throw new ForbiddenError("Session required");
    }

    // Owner cannot leave
    if (user.role === "owner") {
      throw new ForbiddenError("Owner cannot leave organization. Transfer ownership first.");
    }

    // Remove user from organization by nulling their role (preserves BetterAuth account)
    await db.update(users).set({ role: null, updatedAt: new Date() }).where(eq(users.id, user.id));

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminMembers };
