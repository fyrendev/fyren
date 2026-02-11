import { createMiddleware } from "hono/factory";
import { auth, type Session } from "../lib/auth";
import { db, userOrganizations, eq, and } from "@fyrendev/db";
import { UnauthorizedError, ForbiddenError, BadRequestError, errorResponse } from "../lib/errors";
import type { OrgRole } from "@fyrendev/db";

// Get session from request
export async function getSession(headers: Headers): Promise<Session | null> {
  try {
    const session = await auth.api.getSession({
      headers,
    });
    return session;
  } catch {
    // BetterAuth may throw when there's no session cookie or the session is invalid
    return null;
  }
}

// Middleware: Require authenticated user (session only)
export const requireSession = createMiddleware(async (c, next) => {
  try {
    const session = await getSession(c.req.raw.headers);

    if (!session) {
      throw new UnauthorizedError("Session required");
    }

    // Attach session and user to context
    c.set("session", session);
    c.set("user", session.user);
    c.set("authMethod", "session");

    await next();
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Middleware: Require org membership (must be used after requireSession or requireAuthOrApiKey)
export const requireOrgMembership = createMiddleware(async (c, next) => {
  try {
    const user = c.get("user");
    const authMethod = c.get("authMethod");

    // API key auth already has org context set
    if (authMethod === "api_key") {
      await next();
      return;
    }

    if (!user) {
      throw new UnauthorizedError("Authentication required");
    }

    const orgId = c.req.header("X-Organization-Id");

    if (!orgId) {
      throw new BadRequestError("Organization ID required (use X-Organization-Id header)");
    }

    // Check user belongs to org
    const [membership] = await db
      .select()
      .from(userOrganizations)
      .where(
        and(eq(userOrganizations.userId, user.id), eq(userOrganizations.organizationId, orgId))
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenError("Not a member of this organization");
    }

    c.set("membership", membership);
    c.set("organizationId", orgId);

    await next();
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Factory function: Require specific role(s)
export function requireRole(...roles: OrgRole[]) {
  return createMiddleware(async (c, next) => {
    try {
      const authMethod = c.get("authMethod");

      // API key auth bypasses role check (it's already scoped to the org)
      if (authMethod === "api_key") {
        await next();
        return;
      }

      const membership = c.get("membership");

      if (!membership) {
        throw new ForbiddenError("Organization membership required");
      }

      if (!roles.includes(membership.role as OrgRole)) {
        throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
      }

      await next();
    } catch (error) {
      return errorResponse(c, error);
    }
  });
}
