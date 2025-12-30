import { Hono } from "hono";
import { z } from "zod";
import {
  db,
  organizationInvites,
  userOrganizations,
  organizations,
  users,
  eq,
  and,
  isNull,
} from "@fyrendev/db";
import { requireAuthOrApiKey } from "../../middleware/auth";
import { requireSession, requireOrgMembership, requireRole } from "../../middleware/session";
import { errorResponse, NotFoundError, ForbiddenError, BadRequestError, ConflictError } from "../../lib/errors";
import type { AuthUser } from "../../lib/auth";
import type { UserOrganization } from "@fyrendev/db";

type Variables = {
  user?: AuthUser;
  membership?: UserOrganization;
  organizationId?: string;
  authMethod?: "session" | "api_key" | null;
};

const adminInvites = new Hono<{ Variables: Variables }>();

// Generate a random invite token
function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

// GET /api/v1/admin/organizations/:orgId/invites - List pending invites
adminInvites.get(
  "/:orgId/invites",
  requireAuthOrApiKey,
  requireOrgMembership,
  requireRole("owner", "admin"),
  async (c) => {
    try {
      const orgId = c.get("organizationId")!;

      const invites = await db
        .select({
          invite: organizationInvites,
          invitedByUser: users,
        })
        .from(organizationInvites)
        .leftJoin(users, eq(organizationInvites.invitedBy, users.id))
        .where(
          and(
            eq(organizationInvites.organizationId, orgId),
            isNull(organizationInvites.acceptedAt)
          )
        );

      return c.json({
        invites: invites.map((i) => ({
          id: i.invite.id,
          email: i.invite.email,
          role: i.invite.role,
          invitedBy: i.invitedByUser
            ? {
                id: i.invitedByUser.id,
                name: i.invitedByUser.name,
                email: i.invitedByUser.email,
              }
            : null,
          expiresAt: i.invite.expiresAt.toISOString(),
          createdAt: i.invite.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      return errorResponse(c, error);
    }
  }
);

// POST /api/v1/admin/organizations/:orgId/invites - Create invite
adminInvites.post(
  "/:orgId/invites",
  requireAuthOrApiKey,
  requireOrgMembership,
  requireRole("owner", "admin"),
  async (c) => {
    try {
      const orgId = c.get("organizationId")!;
      const membership = c.get("membership");
      const user = c.get("user");
      const authMethod = c.get("authMethod");

      // API key auth needs a user to be the inviter - use a system placeholder
      // For now, we require session auth for invites
      if (authMethod === "api_key" || !user) {
        throw new ForbiddenError("Session authentication required to send invites");
      }

      const body = await c.req.json();
      const data = createInviteSchema.parse(body);

      // Admins can only invite as 'member'
      if (membership?.role === "admin" && data.role === "admin") {
        throw new ForbiddenError("Admins can only invite new members, not other admins");
      }

      // Check if email is already a member
      const [existingMember] = await db
        .select()
        .from(userOrganizations)
        .innerJoin(users, eq(userOrganizations.userId, users.id))
        .where(
          and(
            eq(userOrganizations.organizationId, orgId),
            eq(users.email, data.email)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new ConflictError("User is already a member of this organization");
      }

      // Check if there's already a pending invite
      const [existingInvite] = await db
        .select()
        .from(organizationInvites)
        .where(
          and(
            eq(organizationInvites.organizationId, orgId),
            eq(organizationInvites.email, data.email),
            isNull(organizationInvites.acceptedAt)
          )
        )
        .limit(1);

      if (existingInvite && existingInvite.expiresAt > new Date()) {
        throw new ConflictError("An invite is already pending for this email");
      }

      // Delete expired invite if exists
      if (existingInvite) {
        await db.delete(organizationInvites).where(eq(organizationInvites.id, existingInvite.id));
      }

      // Create new invite
      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const result = await db
        .insert(organizationInvites)
        .values({
          organizationId: orgId,
          email: data.email,
          role: data.role,
          token,
          invitedBy: user.id,
          expiresAt,
        })
        .returning();

      const invite = result[0];
      if (!invite) {
        throw new Error("Failed to create invite");
      }

      // TODO: Send invite email via notification service
      console.log(`Invite created for ${data.email} with token: ${token}`);

      return c.json(
        {
          invite: {
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt.toISOString(),
            createdAt: invite.createdAt.toISOString(),
          },
        },
        201
      );
    } catch (error) {
      return errorResponse(c, error);
    }
  }
);

// DELETE /api/v1/admin/organizations/:orgId/invites/:id - Revoke invite
adminInvites.delete(
  "/:orgId/invites/:id",
  requireAuthOrApiKey,
  requireOrgMembership,
  requireRole("owner", "admin"),
  async (c) => {
    try {
      const orgId = c.get("organizationId")!;
      const inviteId = c.req.param("id");

      const [invite] = await db
        .delete(organizationInvites)
        .where(
          and(
            eq(organizationInvites.id, inviteId),
            eq(organizationInvites.organizationId, orgId)
          )
        )
        .returning();

      if (!invite) {
        throw new NotFoundError("Invite not found");
      }

      return c.json({ success: true });
    } catch (error) {
      return errorResponse(c, error);
    }
  }
);

export { adminInvites };
