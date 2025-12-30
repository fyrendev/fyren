import { Hono } from "hono";
import { z } from "zod";
import { db, userOrganizations, users, orgRoleEnum, eq, and } from "@fyrendev/db";
import { authMiddleware } from "../../middleware/auth";
import { requireOrgMembership, requireRole } from "../../middleware/session";
import { errorResponse, NotFoundError, ForbiddenError, BadRequestError } from "../../lib/errors";
import type { AuthUser } from "../../lib/auth";
import type { UserOrganization } from "@fyrendev/db";

type Variables = {
  user?: AuthUser;
  membership?: UserOrganization;
  organizationId?: string;
  authMethod?: "session" | "api_key" | null;
};

const adminMembers = new Hono<{ Variables: Variables }>();

const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]), // Can't promote to owner via this endpoint
});

// GET /api/v1/admin/organizations/:orgId/members - List org members
adminMembers.get("/:orgId/members", authMiddleware, requireOrgMembership, async (c) => {
  try {
    const orgId = c.get("organizationId")!;

    const members = await db
      .select({
        membership: userOrganizations,
        user: users,
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, orgId));

    return c.json({
      members: members.map((m) => ({
        id: m.membership.id,
        user: {
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          image: m.user.image,
        },
        role: m.membership.role,
        createdAt: m.membership.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/organizations/:orgId/members/:id - Update member role
adminMembers.put(
  "/:orgId/members/:id",
  authMiddleware,
  requireOrgMembership,
  requireRole("owner", "admin"),
  async (c) => {
    try {
      const orgId = c.get("organizationId")!;
      const membershipId = c.req.param("id");
      const currentMembership = c.get("membership");
      const body = await c.req.json();
      const data = updateMemberSchema.parse(body);

      // Get the membership to update
      const [targetMembership] = await db
        .select()
        .from(userOrganizations)
        .where(
          and(
            eq(userOrganizations.id, membershipId),
            eq(userOrganizations.organizationId, orgId)
          )
        )
        .limit(1);

      if (!targetMembership) {
        throw new NotFoundError("Membership not found");
      }

      // Cannot change owner's role
      if (targetMembership.role === "owner") {
        throw new ForbiddenError("Cannot change owner's role. Transfer ownership instead.");
      }

      // Admins can only change members, not other admins
      if (currentMembership?.role === "admin" && targetMembership.role === "admin") {
        throw new ForbiddenError("Admins cannot modify other admins");
      }

      const [updated] = await db
        .update(userOrganizations)
        .set({
          role: data.role,
          updatedAt: new Date(),
        })
        .where(eq(userOrganizations.id, membershipId))
        .returning();

      // Get user info
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, updated.userId))
        .limit(1);

      return c.json({
        member: {
          id: updated.id,
          user: user
            ? {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              }
            : null,
          role: updated.role,
          createdAt: updated.createdAt.toISOString(),
        },
      });
    } catch (error) {
      return errorResponse(c, error);
    }
  }
);

// DELETE /api/v1/admin/organizations/:orgId/members/:id - Remove member
adminMembers.delete(
  "/:orgId/members/:id",
  authMiddleware,
  requireOrgMembership,
  requireRole("owner", "admin"),
  async (c) => {
    try {
      const orgId = c.get("organizationId")!;
      const membershipId = c.req.param("id");
      const currentMembership = c.get("membership");
      const user = c.get("user");

      // Get the membership to delete
      const [targetMembership] = await db
        .select()
        .from(userOrganizations)
        .where(
          and(
            eq(userOrganizations.id, membershipId),
            eq(userOrganizations.organizationId, orgId)
          )
        )
        .limit(1);

      if (!targetMembership) {
        throw new NotFoundError("Membership not found");
      }

      // Cannot remove owner
      if (targetMembership.role === "owner") {
        throw new ForbiddenError("Cannot remove owner. Transfer ownership first.");
      }

      // Cannot remove yourself (use leave endpoint)
      if (user && targetMembership.userId === user.id) {
        throw new BadRequestError("Cannot remove yourself. Use the leave endpoint.");
      }

      // Admins can only remove members, not other admins
      if (currentMembership?.role === "admin" && targetMembership.role === "admin") {
        throw new ForbiddenError("Admins cannot remove other admins");
      }

      await db
        .delete(userOrganizations)
        .where(eq(userOrganizations.id, membershipId));

      return c.json({ success: true });
    } catch (error) {
      return errorResponse(c, error);
    }
  }
);

// POST /api/v1/admin/organizations/:orgId/leave - Leave organization
adminMembers.post("/:orgId/leave", authMiddleware, requireOrgMembership, async (c) => {
  try {
    const membership = c.get("membership");
    const user = c.get("user");
    const authMethod = c.get("authMethod");

    // API key auth cannot leave org
    if (authMethod === "api_key") {
      throw new ForbiddenError("Cannot leave organization via API key");
    }

    if (!membership || !user) {
      throw new ForbiddenError("Session required");
    }

    // Owner cannot leave
    if (membership.role === "owner") {
      throw new ForbiddenError("Owner cannot leave organization. Transfer ownership first.");
    }

    await db
      .delete(userOrganizations)
      .where(eq(userOrganizations.id, membership.id));

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminMembers };
