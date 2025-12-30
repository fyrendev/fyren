import { db } from "../lib/db";
import {
  maintenances,
  maintenanceComponents,
  components,
  organizations,
  eq,
  and,
  desc,
  inArray,
  or,
  gte,
  lte,
  sql,
} from "@fyrendev/db";
import { invalidateStatusCache } from "./cache.service";
import { MaintenanceScheduler } from "./maintenance-scheduler.service";
import { NotificationService } from "./notification.service";
import type { MaintenanceStatus } from "@fyrendev/db";

// Helper to invalidate cache for an organization
async function invalidateOrgCache(organizationId: string): Promise<void> {
  const [org] = await db
    .select({ slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (org) {
    await invalidateStatusCache(org.slug);
  }
}

export const MaintenanceService = {
  async create(data: {
    organizationId: string;
    title: string;
    description?: string;
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    componentIds: string[];
    autoStart: boolean;
    autoComplete: boolean;
    createdBy?: string;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Create maintenance
      const [maintenance] = await tx
        .insert(maintenances)
        .values({
          organizationId: data.organizationId,
          title: data.title,
          description: data.description,
          scheduledStartAt: data.scheduledStartAt,
          scheduledEndAt: data.scheduledEndAt,
          autoStart: data.autoStart,
          autoComplete: data.autoComplete,
          createdBy: data.createdBy,
        })
        .returning();

      if (!maintenance) {
        throw new Error("Failed to create maintenance");
      }

      // 2. Link affected components
      if (data.componentIds.length > 0) {
        await tx.insert(maintenanceComponents).values(
          data.componentIds.map((componentId) => ({
            maintenanceId: maintenance.id,
            componentId,
          }))
        );
      }

      // 3. Schedule jobs for auto-start and auto-complete
      if (data.autoStart) {
        await MaintenanceScheduler.scheduleStart(
          maintenance.id,
          data.scheduledStartAt
        );
      }
      if (data.autoComplete) {
        await MaintenanceScheduler.scheduleComplete(
          maintenance.id,
          data.scheduledEndAt
        );
      }

      // 4. Invalidate cache
      await invalidateOrgCache(data.organizationId);

      // 5. Trigger notifications
      let affectedComponentNames: string[] = [];
      if (data.componentIds.length > 0) {
        const comps = await db
          .select({ name: components.name })
          .from(components)
          .where(inArray(components.id, data.componentIds));
        affectedComponentNames = comps.map((c) => c.name);
      }

      await NotificationService.trigger({
        organizationId: data.organizationId,
        event: "maintenance.scheduled",
        entityType: "maintenance",
        entityId: maintenance.id,
        componentIds: data.componentIds,
        data: {
          title: maintenance.title,
          description: maintenance.description,
          scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
          scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
          affectedComponents: affectedComponentNames,
        },
      });

      return maintenance;
    });
  },

  async update(
    maintenanceId: string,
    organizationId: string,
    data: Partial<{
      title: string;
      description: string | null;
      scheduledStartAt: Date;
      scheduledEndAt: Date;
      componentIds: string[];
      autoStart: boolean;
      autoComplete: boolean;
    }>
  ) {
    return await db.transaction(async (tx) => {
      // 1. Verify maintenance exists and belongs to org
      const [existing] = await tx
        .select()
        .from(maintenances)
        .where(
          and(
            eq(maintenances.id, maintenanceId),
            eq(maintenances.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error("Maintenance not found");
      }

      if (existing.status !== "scheduled") {
        throw new Error("Can only update scheduled maintenance");
      }

      // 2. Update maintenance
      const updateData: Partial<typeof maintenances.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.scheduledStartAt !== undefined)
        updateData.scheduledStartAt = data.scheduledStartAt;
      if (data.scheduledEndAt !== undefined)
        updateData.scheduledEndAt = data.scheduledEndAt;
      if (data.autoStart !== undefined) updateData.autoStart = data.autoStart;
      if (data.autoComplete !== undefined)
        updateData.autoComplete = data.autoComplete;

      const [updated] = await tx
        .update(maintenances)
        .set(updateData)
        .where(eq(maintenances.id, maintenanceId))
        .returning();

      if (!updated) {
        throw new Error("Failed to update maintenance");
      }

      // 3. Update components if provided
      if (data.componentIds !== undefined) {
        await tx
          .delete(maintenanceComponents)
          .where(eq(maintenanceComponents.maintenanceId, maintenanceId));

        if (data.componentIds.length > 0) {
          await tx.insert(maintenanceComponents).values(
            data.componentIds.map((componentId) => ({
              maintenanceId,
              componentId,
            }))
          );
        }
      }

      // 4. Reschedule jobs if times or auto flags changed
      if (data.scheduledStartAt !== undefined || data.autoStart !== undefined) {
        await MaintenanceScheduler.cancelStart(maintenanceId);
        if (updated.autoStart) {
          await MaintenanceScheduler.scheduleStart(
            maintenanceId,
            updated.scheduledStartAt
          );
        }
      }

      if (
        data.scheduledEndAt !== undefined ||
        data.autoComplete !== undefined
      ) {
        await MaintenanceScheduler.cancelComplete(maintenanceId);
        if (updated.autoComplete) {
          await MaintenanceScheduler.scheduleComplete(
            maintenanceId,
            updated.scheduledEndAt
          );
        }
      }

      // 5. Invalidate cache
      await invalidateOrgCache(organizationId);

      return updated;
    });
  },

  async start(maintenanceId: string, organizationId: string) {
    return await db.transaction(async (tx) => {
      const [maintenance] = await tx
        .select()
        .from(maintenances)
        .where(
          and(
            eq(maintenances.id, maintenanceId),
            eq(maintenances.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!maintenance) {
        throw new Error("Maintenance not found");
      }

      if (maintenance.status !== "scheduled") {
        throw new Error("Maintenance is not in scheduled status");
      }

      // Get affected components
      const affectedComps = await tx
        .select({ componentId: maintenanceComponents.componentId })
        .from(maintenanceComponents)
        .where(eq(maintenanceComponents.maintenanceId, maintenanceId));

      // 1. Update maintenance status
      const [updated] = await tx
        .update(maintenances)
        .set({
          status: "in_progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(maintenances.id, maintenanceId))
        .returning();

      // 2. Update component status to maintenance
      const componentIds = affectedComps.map((ac) => ac.componentId);
      if (componentIds.length > 0) {
        await tx
          .update(components)
          .set({
            status: "maintenance",
            updatedAt: new Date(),
          })
          .where(inArray(components.id, componentIds));
      }

      // 3. Invalidate cache
      await invalidateOrgCache(organizationId);

      // 4. Trigger notifications
      let affectedComponentNames: string[] = [];
      if (componentIds.length > 0) {
        const comps = await db
          .select({ name: components.name })
          .from(components)
          .where(inArray(components.id, componentIds));
        affectedComponentNames = comps.map((c) => c.name);
      }

      await NotificationService.trigger({
        organizationId,
        event: "maintenance.started",
        entityType: "maintenance",
        entityId: maintenanceId,
        componentIds,
        data: {
          title: maintenance.title,
          description: maintenance.description,
          scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
          scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
          affectedComponents: affectedComponentNames,
        },
      });

      return updated;
    });
  },

  async complete(maintenanceId: string, organizationId: string) {
    return await db.transaction(async (tx) => {
      const [maintenance] = await tx
        .select()
        .from(maintenances)
        .where(
          and(
            eq(maintenances.id, maintenanceId),
            eq(maintenances.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!maintenance) {
        throw new Error("Maintenance not found");
      }

      if (maintenance.status !== "in_progress") {
        throw new Error("Maintenance is not in progress");
      }

      // Get affected components
      const affectedComps = await tx
        .select({ componentId: maintenanceComponents.componentId })
        .from(maintenanceComponents)
        .where(eq(maintenanceComponents.maintenanceId, maintenanceId));

      // 1. Update maintenance status
      const [updated] = await tx
        .update(maintenances)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(maintenances.id, maintenanceId))
        .returning();

      // 2. Restore component status to operational
      const componentIds = affectedComps.map((ac) => ac.componentId);
      if (componentIds.length > 0) {
        await tx
          .update(components)
          .set({
            status: "operational",
            updatedAt: new Date(),
          })
          .where(inArray(components.id, componentIds));
      }

      // 3. Cancel any pending complete job
      await MaintenanceScheduler.cancelComplete(maintenanceId);

      // 4. Invalidate cache
      await invalidateOrgCache(organizationId);

      // 5. Trigger notifications
      let affectedComponentNames: string[] = [];
      if (componentIds.length > 0) {
        const comps = await db
          .select({ name: components.name })
          .from(components)
          .where(inArray(components.id, componentIds));
        affectedComponentNames = comps.map((c) => c.name);
      }

      await NotificationService.trigger({
        organizationId,
        event: "maintenance.completed",
        entityType: "maintenance",
        entityId: maintenanceId,
        componentIds,
        data: {
          title: maintenance.title,
          description: maintenance.description,
          scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
          scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
          affectedComponents: affectedComponentNames,
        },
      });

      return updated;
    });
  },

  async cancel(maintenanceId: string, organizationId: string) {
    return await db.transaction(async (tx) => {
      const [maintenance] = await tx
        .select()
        .from(maintenances)
        .where(
          and(
            eq(maintenances.id, maintenanceId),
            eq(maintenances.organizationId, organizationId)
          )
        )
        .limit(1);

      if (!maintenance) {
        throw new Error("Maintenance not found");
      }

      if (
        maintenance.status === "completed" ||
        maintenance.status === "cancelled"
      ) {
        throw new Error("Maintenance is already completed or cancelled");
      }

      // If in progress, restore components first
      if (maintenance.status === "in_progress") {
        const affectedComps = await tx
          .select({ componentId: maintenanceComponents.componentId })
          .from(maintenanceComponents)
          .where(eq(maintenanceComponents.maintenanceId, maintenanceId));

        const componentIds = affectedComps.map((ac) => ac.componentId);
        if (componentIds.length > 0) {
          await tx
            .update(components)
            .set({
              status: "operational",
              updatedAt: new Date(),
            })
            .where(inArray(components.id, componentIds));
        }
      }

      // 1. Update maintenance status
      const [updated] = await tx
        .update(maintenances)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(maintenances.id, maintenanceId))
        .returning();

      // 2. Cancel scheduled jobs
      await MaintenanceScheduler.cancelStart(maintenanceId);
      await MaintenanceScheduler.cancelComplete(maintenanceId);

      // 3. Invalidate cache
      await invalidateOrgCache(organizationId);

      return updated;
    });
  },

  async getById(maintenanceId: string, organizationId: string) {
    const [maintenance] = await db
      .select()
      .from(maintenances)
      .where(
        and(
          eq(maintenances.id, maintenanceId),
          eq(maintenances.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!maintenance) {
      return null;
    }

    // Get affected components
    const affectedComps = await db
      .select({
        id: components.id,
        name: components.name,
        status: components.status,
      })
      .from(maintenanceComponents)
      .innerJoin(components, eq(maintenanceComponents.componentId, components.id))
      .where(eq(maintenanceComponents.maintenanceId, maintenanceId));

    return {
      ...maintenance,
      affectedComponents: affectedComps,
    };
  },

  async list(
    organizationId: string,
    options: {
      status?: MaintenanceStatus;
      upcoming?: boolean;
      limit: number;
      offset: number;
    }
  ) {
    const conditions = [eq(maintenances.organizationId, organizationId)];

    if (options.status) {
      conditions.push(eq(maintenances.status, options.status));
    }

    if (options.upcoming) {
      // Upcoming = scheduled or in_progress, with end time in future
      conditions.push(
        or(
          eq(maintenances.status, "scheduled"),
          eq(maintenances.status, "in_progress")
        )!
      );
      conditions.push(gte(maintenances.scheduledEndAt, new Date()));
    }

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(maintenances)
        .where(and(...conditions))
        .orderBy(desc(maintenances.scheduledStartAt))
        .limit(options.limit)
        .offset(options.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(maintenances)
        .where(and(...conditions)),
    ]);

    // Get affected components for each maintenance
    const maintenancesWithDetails = await Promise.all(
      items.map(async (maintenance) => {
        const affectedComps = await db
          .select({
            id: components.id,
            name: components.name,
          })
          .from(maintenanceComponents)
          .innerJoin(
            components,
            eq(maintenanceComponents.componentId, components.id)
          )
          .where(eq(maintenanceComponents.maintenanceId, maintenance.id));

        return {
          ...maintenance,
          affectedComponents: affectedComps,
        };
      })
    );

    return {
      maintenances: maintenancesWithDetails,
      pagination: {
        total: Number(countResult[0]?.count || 0),
        limit: options.limit,
        offset: options.offset,
      },
    };
  },

  // Called by scheduler when auto-start time is reached
  async autoStart(maintenanceId: string) {
    const [maintenance] = await db
      .select({
        organizationId: maintenances.organizationId,
        status: maintenances.status,
      })
      .from(maintenances)
      .where(eq(maintenances.id, maintenanceId))
      .limit(1);

    if (!maintenance || maintenance.status !== "scheduled") {
      return; // Already started/cancelled/completed
    }

    await this.start(maintenanceId, maintenance.organizationId);
  },

  // Called by scheduler when auto-complete time is reached
  async autoComplete(maintenanceId: string) {
    const [maintenance] = await db
      .select({
        organizationId: maintenances.organizationId,
        status: maintenances.status,
      })
      .from(maintenances)
      .where(eq(maintenances.id, maintenanceId))
      .limit(1);

    if (!maintenance || maintenance.status !== "in_progress") {
      return; // Not in progress
    }

    await this.complete(maintenanceId, maintenance.organizationId);
  },
};
