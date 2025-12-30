import { Hono } from "hono";
import { db, eq, and, desc, sql } from "@fyrendev/db";
import { subscribers } from "@fyrendev/db";
import { z } from "zod";
import { errorResponse, NotFoundError, ValidationError } from "../../lib/errors";

export const adminSubscribers = new Hono();

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  verified: z.enum(["true", "false", "all"]).optional().default("all"),
});

// List subscribers
adminSubscribers.get("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const query = listSchema.parse({
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
      verified: c.req.query("verified"),
    });

    const conditions = [eq(subscribers.organizationId, orgId)];

    if (query.verified === "true") {
      conditions.push(eq(subscribers.verified, true));
    } else if (query.verified === "false") {
      conditions.push(eq(subscribers.verified, false));
    }

    const [items, countResult] = await Promise.all([
      db.query.subscribers.findMany({
        where: and(...conditions),
        columns: {
          id: true,
          email: true,
          verified: true,
          verifiedAt: true,
          componentIds: true,
          notifyOnIncident: true,
          notifyOnMaintenance: true,
          createdAt: true,
        },
        orderBy: [desc(subscribers.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(subscribers)
        .where(and(...conditions)),
    ]);

    return c.json({
      subscribers: items,
      pagination: {
        total: Number(countResult[0]?.count || 0),
        limit: query.limit,
        offset: query.offset,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Delete subscriber
adminSubscribers.delete("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const subscriberId = c.req.param("id");

    const subscriber = await db.query.subscribers.findFirst({
      where: and(
        eq(subscribers.id, subscriberId),
        eq(subscribers.organizationId, orgId)
      ),
    });

    if (!subscriber) {
      throw new NotFoundError("Subscriber not found");
    }

    await db.delete(subscribers).where(eq(subscribers.id, subscriberId));

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Export subscribers as CSV
adminSubscribers.get("/export", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const subs = await db.query.subscribers.findMany({
      where: and(
        eq(subscribers.organizationId, orgId),
        eq(subscribers.verified, true)
      ),
      columns: {
        email: true,
        verifiedAt: true,
        createdAt: true,
      },
      orderBy: [subscribers.email],
    });

    const csv = [
      "email,verified_at,subscribed_at",
      ...subs.map(
        (s) =>
          `${s.email},${s.verifiedAt?.toISOString() || ""},${s.createdAt.toISOString()}`
      ),
    ].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="subscribers.csv"',
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
