import { Hono } from "hono";
import { z } from "zod";
import { db, eq, subscriberGroups, subscribers } from "@fyrendev/db";
import { errorResponse, NotFoundError, ForbiddenError, ValidationError } from "../../lib/errors";

export const subscriberGroupsRouter = new Hono();

const createGroupSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  componentIds: z.array(z.string().uuid()).nullable().optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  componentIds: z.array(z.string().uuid()).nullable().optional(),
});

function serializeGroup(group: typeof subscriberGroups.$inferSelect, memberCount?: number) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    componentIds: group.componentIds,
    memberCount: memberCount ?? 0,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

// GET /subscriber-groups - List all subscriber groups
subscriberGroupsRouter.get("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }

    const groups = await db.query.subscriberGroups.findMany({
      where: eq(subscriberGroups.organizationId, orgId),
      orderBy: (subscriberGroups, { asc }) => [asc(subscriberGroups.name)],
    });

    // Get member counts for each group
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const members = await db.query.subscribers.findMany({
          where: eq(subscribers.groupId, group.id),
          columns: { id: true },
        });
        return serializeGroup(group, members.length);
      })
    );

    return c.json({ subscriberGroups: groupsWithCounts });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /subscriber-groups/:id - Get a single subscriber group
subscriberGroupsRouter.get("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }

    const id = c.req.param("id");

    const group = await db.query.subscriberGroups.findFirst({
      where: eq(subscriberGroups.id, id),
    });

    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    if (group.organizationId !== orgId) {
      throw new ForbiddenError("You don't have access to this subscriber group");
    }

    // Get member count
    const members = await db.query.subscribers.findMany({
      where: eq(subscribers.groupId, group.id),
      columns: { id: true },
    });

    return c.json({ subscriberGroup: serializeGroup(group, members.length) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /subscriber-groups - Create a new subscriber group
subscriberGroupsRouter.post("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }

    const body = await c.req.json();
    const data = createGroupSchema.parse(body);

    const [group] = await db
      .insert(subscriberGroups)
      .values({
        organizationId: orgId,
        name: data.name,
        description: data.description ?? null,
        componentIds: data.componentIds ?? null,
      })
      .returning();

    if (!group) {
      throw new Error("Failed to create subscriber group");
    }

    return c.json({ subscriberGroup: serializeGroup(group, 0) }, 201);
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /subscriber-groups/:id - Update a subscriber group
subscriberGroupsRouter.put("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }

    const id = c.req.param("id");
    const body = await c.req.json();
    const data = updateGroupSchema.parse(body);

    // Verify ownership
    const existing = await db.query.subscriberGroups.findFirst({
      where: eq(subscriberGroups.id, id),
    });

    if (!existing) {
      throw new NotFoundError("Subscriber group not found");
    }

    if (existing.organizationId !== orgId) {
      throw new ForbiddenError("You don't have access to this subscriber group");
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.componentIds !== undefined) {
      updateData.componentIds = data.componentIds;
    }

    const [group] = await db
      .update(subscriberGroups)
      .set(updateData)
      .where(eq(subscriberGroups.id, id))
      .returning();

    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    // Get member count
    const members = await db.query.subscribers.findMany({
      where: eq(subscribers.groupId, group.id),
      columns: { id: true },
    });

    return c.json({ subscriberGroup: serializeGroup(group, members.length) });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// DELETE /subscriber-groups/:id - Delete a subscriber group
subscriberGroupsRouter.delete("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }

    const id = c.req.param("id");

    // Verify ownership
    const existing = await db.query.subscriberGroups.findFirst({
      where: eq(subscriberGroups.id, id),
    });

    if (!existing) {
      throw new NotFoundError("Subscriber group not found");
    }

    if (existing.organizationId !== orgId) {
      throw new ForbiddenError("You don't have access to this subscriber group");
    }

    // Check if there are subscribers in this group
    const members = await db.query.subscribers.findMany({
      where: eq(subscribers.groupId, id),
      columns: { id: true },
    });

    if (members.length > 0) {
      throw new ValidationError(
        `Cannot delete group with ${members.length} subscriber(s). Remove or reassign subscribers first.`
      );
    }

    await db.delete(subscriberGroups).where(eq(subscriberGroups.id, id));

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /subscriber-groups/:id/members - Get members of a subscriber group
subscriberGroupsRouter.get("/:id/members", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ForbiddenError("Authentication required");
    }

    const id = c.req.param("id");

    // Verify ownership
    const group = await db.query.subscriberGroups.findFirst({
      where: eq(subscriberGroups.id, id),
    });

    if (!group) {
      throw new NotFoundError("Subscriber group not found");
    }

    if (group.organizationId !== orgId) {
      throw new ForbiddenError("You don't have access to this subscriber group");
    }

    const members = await db.query.subscribers.findMany({
      where: eq(subscribers.groupId, id),
      orderBy: (subscribers, { asc }) => [asc(subscribers.email)],
    });

    return c.json({
      subscribers: members.map((sub) => ({
        id: sub.id,
        email: sub.email,
        verified: sub.verified,
        notifyOnIncident: sub.notifyOnIncident,
        notifyOnMaintenance: sub.notifyOnMaintenance,
        createdAt: sub.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});
