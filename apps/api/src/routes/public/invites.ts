import { and, db, eq, isNull, organizationInvites, users } from "@fyrendev/db";
import { Hono } from "hono";
import type { AuthUser } from "../../lib/auth";
import {
  BadRequestError,
  ConflictError,
  errorResponse,
  ForbiddenError,
  NotFoundError,
} from "../../lib/errors";
import { getOrganization } from "../../lib/organization";
import { requireSession } from "../../middleware/session";

type Variables = {
  user?: AuthUser;
};

const publicInvites = new Hono<{ Variables: Variables }>();

// GET /api/v1/invites/:token - Get invite details (public, for showing before login)
publicInvites.get("/:token", async (c) => {
  try {
    const token = c.req.param("token");

    const invite = await db.query.organizationInvites.findFirst({
      where: and(eq(organizationInvites.token, token), isNull(organizationInvites.acceptedAt)),
    });

    if (!invite) {
      throw new NotFoundError("Invite not found or already used");
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestError("Invite has expired");
    }

    const org = await getOrganization();

    return c.json({
      invite: {
        organization: {
          name: org.name,
        },
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt.toISOString(),
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
    const invite = await db.query.organizationInvites.findFirst({
      where: and(eq(organizationInvites.token, token), isNull(organizationInvites.acceptedAt)),
    });

    if (!invite) {
      throw new NotFoundError("Invite not found or already used");
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestError("Invite has expired");
    }

    // Verify user email matches invite email
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new ForbiddenError("This invite was sent to a different email address");
    }

    // Check if user already has a role (is already a member)
    const [existingUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (existingUser?.role) {
      throw new ConflictError("You are already a member of this organization");
    }

    // Set user role and mark invite as accepted atomically
    await db.transaction(async (tx) => {
      await tx.update(users).set({ role: invite.role }).where(eq(users.id, user.id));
      await tx
        .update(organizationInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(organizationInvites.id, invite.id));
    });

    const org = await getOrganization();

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
      },
      role: invite.role,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { publicInvites };
