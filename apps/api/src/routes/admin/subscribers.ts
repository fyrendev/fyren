import { Hono } from "hono";
import { db, eq, and, desc, sql } from "@fyrendev/db";
import { subscribers } from "@fyrendev/db";
import { z } from "zod";
import { errorResponse, NotFoundError, ValidationError } from "../../lib/errors";
import { SubscriberService } from "../../services/subscriber.service";

export const adminSubscribers = new Hono();

const listSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  verified: z.enum(["true", "false", "all"]).optional().default("all"),
  groupId: z.string().uuid().optional(),
});

const createSubscriberSchema = z.object({
  email: z.string().email(),
  groupId: z.string().uuid().nullable().optional(),
  componentIds: z.array(z.string().uuid()).nullable().optional(),
  notifyOnIncident: z.boolean().optional().default(true),
  notifyOnMaintenance: z.boolean().optional().default(true),
});

const updateSubscriberSchema = z.object({
  email: z.string().email().optional(),
  groupId: z.string().uuid().nullable().optional(),
  componentIds: z.array(z.string().uuid()).nullable().optional(),
  notifyOnIncident: z.boolean().optional(),
  notifyOnMaintenance: z.boolean().optional(),
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
      groupId: c.req.query("groupId"),
    });

    const conditions = [eq(subscribers.organizationId, orgId)];

    if (query.verified === "true") {
      conditions.push(eq(subscribers.verified, true));
    } else if (query.verified === "false") {
      conditions.push(eq(subscribers.verified, false));
    }

    if (query.groupId) {
      conditions.push(eq(subscribers.groupId, query.groupId));
    }

    const [items, countResult] = await Promise.all([
      db.query.subscribers.findMany({
        where: and(...conditions),
        with: {
          group: {
            columns: {
              id: true,
              name: true,
            },
          },
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
      subscribers: items.map((sub) => ({
        id: sub.id,
        email: sub.email,
        verified: sub.verified,
        verifiedAt: sub.verifiedAt?.toISOString() || null,
        groupId: sub.groupId,
        group: sub.group
          ? {
              id: sub.group.id,
              name: sub.group.name,
            }
          : null,
        componentIds: sub.componentIds,
        notifyOnIncident: sub.notifyOnIncident,
        notifyOnMaintenance: sub.notifyOnMaintenance,
        createdAt: sub.createdAt.toISOString(),
        updatedAt: sub.updatedAt.toISOString(),
      })),
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

// Get single subscriber
adminSubscribers.get("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const subscriberId = c.req.param("id");

    const subscriber = await SubscriberService.getSubscriberWithGroup(subscriberId);

    if (!subscriber) {
      throw new NotFoundError("Subscriber not found");
    }

    if (subscriber.organizationId !== orgId) {
      throw new NotFoundError("Subscriber not found");
    }

    return c.json({
      subscriber: {
        id: subscriber.id,
        email: subscriber.email,
        verified: subscriber.verified,
        verifiedAt: subscriber.verifiedAt?.toISOString() || null,
        groupId: subscriber.groupId,
        group: subscriber.group
          ? {
              id: subscriber.group.id,
              name: subscriber.group.name,
            }
          : null,
        componentIds: subscriber.componentIds,
        notifyOnIncident: subscriber.notifyOnIncident,
        notifyOnMaintenance: subscriber.notifyOnMaintenance,
        createdAt: subscriber.createdAt.toISOString(),
        updatedAt: subscriber.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Create subscriber (admin-added, auto-verified)
adminSubscribers.post("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const body = await c.req.json();
    const data = createSubscriberSchema.parse(body);

    // Check if subscriber already exists
    const existing = await db.query.subscribers.findFirst({
      where: and(eq(subscribers.organizationId, orgId), eq(subscribers.email, data.email)),
    });

    if (existing) {
      throw new ValidationError("A subscriber with this email already exists");
    }

    const subscriber = await SubscriberService.createManualSubscriber({
      organizationId: orgId,
      email: data.email,
      groupId: data.groupId,
      componentIds: data.componentIds,
      notifyOnIncident: data.notifyOnIncident,
      notifyOnMaintenance: data.notifyOnMaintenance,
    });

    // Get with group info
    const subscriberWithGroup = await SubscriberService.getSubscriberWithGroup(subscriber.id);

    return c.json(
      {
        subscriber: {
          id: subscriberWithGroup!.id,
          email: subscriberWithGroup!.email,
          verified: subscriberWithGroup!.verified,
          verifiedAt: subscriberWithGroup!.verifiedAt?.toISOString() || null,
          groupId: subscriberWithGroup!.groupId,
          group: subscriberWithGroup!.group
            ? {
                id: subscriberWithGroup!.group.id,
                name: subscriberWithGroup!.group.name,
              }
            : null,
          componentIds: subscriberWithGroup!.componentIds,
          notifyOnIncident: subscriberWithGroup!.notifyOnIncident,
          notifyOnMaintenance: subscriberWithGroup!.notifyOnMaintenance,
          createdAt: subscriberWithGroup!.createdAt.toISOString(),
          updatedAt: subscriberWithGroup!.updatedAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Update subscriber
adminSubscribers.put("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const subscriberId = c.req.param("id");
    const body = await c.req.json();
    const data = updateSubscriberSchema.parse(body);

    // Verify subscriber exists and belongs to org
    const existing = await db.query.subscribers.findFirst({
      where: and(eq(subscribers.id, subscriberId), eq(subscribers.organizationId, orgId)),
    });

    if (!existing) {
      throw new NotFoundError("Subscriber not found");
    }

    // If changing email, check for duplicates
    if (data.email && data.email !== existing.email) {
      const duplicate = await db.query.subscribers.findFirst({
        where: and(eq(subscribers.organizationId, orgId), eq(subscribers.email, data.email)),
      });
      if (duplicate) {
        throw new ValidationError("A subscriber with this email already exists");
      }
    }

    await SubscriberService.updateSubscriber(subscriberId, data);

    // Get updated subscriber with group info
    const subscriber = await SubscriberService.getSubscriberWithGroup(subscriberId);

    return c.json({
      subscriber: {
        id: subscriber!.id,
        email: subscriber!.email,
        verified: subscriber!.verified,
        verifiedAt: subscriber!.verifiedAt?.toISOString() || null,
        groupId: subscriber!.groupId,
        group: subscriber!.group
          ? {
              id: subscriber!.group.id,
              name: subscriber!.group.name,
            }
          : null,
        componentIds: subscriber!.componentIds,
        notifyOnIncident: subscriber!.notifyOnIncident,
        notifyOnMaintenance: subscriber!.notifyOnMaintenance,
        createdAt: subscriber!.createdAt.toISOString(),
        updatedAt: subscriber!.updatedAt.toISOString(),
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
      where: and(eq(subscribers.id, subscriberId), eq(subscribers.organizationId, orgId)),
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
      where: and(eq(subscribers.organizationId, orgId), eq(subscribers.verified, true)),
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
        (s) => `${s.email},${s.verifiedAt?.toISOString() || ""},${s.createdAt.toISOString()}`
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
