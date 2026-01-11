import { Hono } from "hono";
import { db, organizations, users, sql } from "@fyrendev/db";

export const setupRoutes = new Hono();

// GET /api/v1/setup/status - Check if initial setup is needed
setupRoutes.get("/status", async (c) => {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);

  const [orgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(organizations);

  const hasUsers = (userCount?.count ?? 0) > 0;
  const hasOrganization = (orgCount?.count ?? 0) > 0;
  const needsSetup = !hasOrganization;

  return c.json({
    needsSetup,
    hasUsers,
    hasOrganization,
  });
});
