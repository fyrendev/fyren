import { createMiddleware } from "hono/factory";
import { auth, type Session } from "../lib/auth";
import { UnauthorizedError, ForbiddenError, errorResponse } from "../lib/errors";
import { db, eq, users, type OrgRole, type ApiKeyScope } from "@fyrendev/db";
import { SCOPE_ROLE_EQUIVALENCES } from "./scope";

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

    // Fetch current role from DB (BetterAuth cookie cache may be stale)
    const [dbUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    const userWithRole = { ...session.user, role: dbUser?.role || null };

    // Attach session and user to context
    c.set("session", session);
    c.set("user", userWithRole);
    c.set("authMethod", "session");

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

      if (authMethod === "api_key") {
        // Map API key scope to equivalent org roles
        const apiKeyScope = c.get("apiKeyScope") as string | null;
        if (!apiKeyScope) {
          throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
        }
        const equivalentRoles = SCOPE_ROLE_EQUIVALENCES[apiKeyScope as ApiKeyScope] || [];
        const hasAccess = roles.some((role) => equivalentRoles.includes(role));
        if (!hasAccess) {
          throw new ForbiddenError(
            `API key scope "${apiKeyScope}" insufficient. Requires one of: ${roles.join(", ")}`
          );
        }

        await next();
        return;
      }

      const user = c.get("user");

      if (!user || !user.role) {
        throw new ForbiddenError("Organization membership required");
      }

      if (!roles.includes(user.role as OrgRole)) {
        throw new ForbiddenError(`Requires one of: ${roles.join(", ")}`);
      }

      await next();
    } catch (error) {
      return errorResponse(c, error);
    }
  });
}
