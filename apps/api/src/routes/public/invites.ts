import { Hono } from "hono";
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
import { requireSession } from "../../middleware/session";
import { errorResponse, NotFoundError, ForbiddenError, BadRequestError, ConflictError } from "../../lib/errors";
import type { AuthUser } from "../../lib/auth";

type Variables = {
  user?: AuthUser;
};

const publicInvites = new Hono<{ Variables: Variables }>();

// GET /api/v1/invites/:token - Get invite details (public, for showing before login)
publicInvites.get("/:token", async (c) => {
  try {
    const token = c.req.param("token");

    const [result] = await db
      .select({
        invite: organizationInvites,
        organization: organizations,
      })
      .from(organizationInvites)
      .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
      .where(
        and(
          eq(organizationInvites.token, token),
          isNull(organizationInvites.acceptedAt)
        )
      )
      .limit(1);

    if (!result) {
      throw new NotFoundError("Invite not found or already used");
    }

    if (result.invite.expiresAt < new Date()) {
      throw new BadRequestError("Invite has expired");
    }

    return c.json({
      invite: {
        organization: {
          name: result.organization.name,
          slug: result.organization.slug,
        },
        email: result.invite.email,
        role: result.invite.role,
        expiresAt: result.invite.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/invites/:token/accept - Accept invite (requires login)
publicInvites.post("/:token/accept", requireSession, async (c) => {
  try {
    const token = c.req.param("token");
    const user = c.get("user")!;

    // Get the invite
    const [result] = await db
      .select({
        invite: organizationInvites,
        organization: organizations,
      })
      .from(organizationInvites)
      .innerJoin(organizations, eq(organizationInvites.organizationId, organizations.id))
      .where(
        and(
          eq(organizationInvites.token, token),
          isNull(organizationInvites.acceptedAt)
        )
      )
      .limit(1);

    if (!result) {
      throw new NotFoundError("Invite not found or already used");
    }

    if (result.invite.expiresAt < new Date()) {
      throw new BadRequestError("Invite has expired");
    }

    // Verify user email matches invite email
    if (user.email.toLowerCase() !== result.invite.email.toLowerCase()) {
      throw new ForbiddenError("This invite was sent to a different email address");
    }

    // Check if user is already a member
    const [existingMembership] = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, user.id),
          eq(userOrganizations.organizationId, result.invite.organizationId)
        )
      )
      .limit(1);

    if (existingMembership) {
      throw new ConflictError("You are already a member of this organization");
    }

    // Create membership
    await db.insert(userOrganizations).values({
      userId: user.id,
      organizationId: result.invite.organizationId,
      role: result.invite.role,
    });

    // Mark invite as accepted
    await db
      .update(organizationInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationInvites.id, result.invite.id));

    return c.json({
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
      },
      role: result.invite.role,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { publicInvites };
