import {
  db,
  incidents,
  incidentUpdates,
  incidentComponents,
  components,
  eq,
  and,
  desc,
  inArray,
  isNull,
  isNotNull,
  sql,
} from "@fyrendev/db";
import { invalidateStatusCache } from "./cache.service";
import { NotificationService } from "./notification.service";
import { getOrganization } from "../lib/organization";
import type { IncidentStatus, IncidentSeverity, ComponentStatus } from "@fyrendev/db";

// Helper: map severity to component status
function severityToComponentStatus(severity: IncidentSeverity): ComponentStatus {
  switch (severity) {
    case "minor":
      return "degraded";
    case "major":
      return "partial_outage";
    case "critical":
      return "major_outage";
  }
}

// Helper to invalidate cache
async function invalidateCache(): Promise<void> {
  try {
    const org = await getOrganization();
    await invalidateStatusCache(org.id);
  } catch {
    // No org configured yet, nothing to invalidate
  }
}

export const IncidentService = {
  async create(data: {
    title: string;
    severity: IncidentSeverity;
    status: IncidentStatus;
    message: string;
    componentIds: string[];
    createdBy?: string;
    triggeredByMonitorId?: string;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Create incident
      const [incident] = await tx
        .insert(incidents)
        .values({
          title: data.title,
          severity: data.severity,
          status: data.status,
          triggeredByMonitorId: data.triggeredByMonitorId,
        })
        .returning();

      if (!incident) {
        throw new Error("Failed to create incident");
      }

      // 2. Create initial update
      await tx.insert(incidentUpdates).values({
        incidentId: incident.id,
        status: data.status,
        message: data.message,
        createdBy: data.createdBy,
      });

      // 3. Link affected components
      if (data.componentIds.length > 0) {
        await tx.insert(incidentComponents).values(
          data.componentIds.map((componentId) => ({
            incidentId: incident.id,
            componentId,
          }))
        );

        // 4. Update component status based on severity
        const componentStatus = severityToComponentStatus(data.severity);
        await tx
          .update(components)
          .set({ status: componentStatus, updatedAt: new Date() })
          .where(inArray(components.id, data.componentIds));
      }

      // 5. Invalidate cache
      await invalidateCache();

      // 6. Trigger notifications
      let affectedComponentNames: string[] = [];
      if (data.componentIds.length > 0) {
        const comps = await db
          .select({ name: components.name })
          .from(components)
          .where(inArray(components.id, data.componentIds));
        affectedComponentNames = comps.map((c) => c.name);
      }

      await NotificationService.trigger({
        event: "incident.created",
        entityType: "incident",
        entityId: incident.id,
        componentIds: data.componentIds,
        data: {
          title: incident.title,
          status: incident.status,
          severity: incident.severity,
          message: data.message,
          affectedComponents: affectedComponentNames,
        },
      });

      return incident;
    });
  },

  async addUpdate(data: {
    incidentId: string;
    status: IncidentStatus;
    message: string;
    createdBy?: string;
  }) {
    return await db.transaction(async (tx) => {
      // 1. Verify incident exists
      const [incident] = await tx
        .select({
          id: incidents.id,
          severity: incidents.severity,
        })
        .from(incidents)
        .where(eq(incidents.id, data.incidentId))
        .limit(1);

      if (!incident) {
        throw new Error("Incident not found");
      }

      // Get affected components
      const affectedComps = await tx
        .select({ componentId: incidentComponents.componentId })
        .from(incidentComponents)
        .where(eq(incidentComponents.incidentId, data.incidentId));

      // 2. Create update
      const [update] = await tx
        .insert(incidentUpdates)
        .values({
          incidentId: data.incidentId,
          status: data.status,
          message: data.message,
          createdBy: data.createdBy,
        })
        .returning();

      // 3. Update incident status
      const updateData: {
        status: IncidentStatus;
        updatedAt: Date;
        resolvedAt?: Date;
      } = {
        status: data.status,
        updatedAt: new Date(),
      };

      if (data.status === "resolved") {
        updateData.resolvedAt = new Date();

        // Restore component status to operational
        const componentIds = affectedComps.map((ac) => ac.componentId);
        if (componentIds.length > 0) {
          await tx
            .update(components)
            .set({ status: "operational", updatedAt: new Date() })
            .where(inArray(components.id, componentIds));
        }
      }

      await tx.update(incidents).set(updateData).where(eq(incidents.id, data.incidentId));

      // 4. Invalidate cache
      await invalidateCache();

      // 5. Trigger notifications
      const [fullIncident] = await db
        .select({
          title: incidents.title,
          severity: incidents.severity,
        })
        .from(incidents)
        .where(eq(incidents.id, data.incidentId))
        .limit(1);

      const componentIds = affectedComps.map((ac) => ac.componentId);
      let affectedComponentNames: string[] = [];
      if (componentIds.length > 0) {
        const comps = await db
          .select({ name: components.name })
          .from(components)
          .where(inArray(components.id, componentIds));
        affectedComponentNames = comps.map((c) => c.name);
      }

      const eventType = data.status === "resolved" ? "incident.resolved" : "incident.updated";

      await NotificationService.trigger({
        event: eventType,
        entityType: "incident",
        entityId: data.incidentId,
        componentIds,
        data: {
          title: fullIncident?.title || "Incident",
          status: data.status,
          severity: fullIncident?.severity || "minor",
          message: data.message,
          affectedComponents: affectedComponentNames,
        },
      });

      return update;
    });
  },

  async resolve(data: { incidentId: string; message?: string; createdBy?: string }) {
    const defaultMessage = "This incident has been resolved.";

    return this.addUpdate({
      incidentId: data.incidentId,
      status: "resolved",
      message: data.message || defaultMessage,
      createdBy: data.createdBy,
    });
  },

  async getById(incidentId: string) {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, incidentId))
      .limit(1);

    if (!incident) {
      return null;
    }

    // Get updates
    const updates = await db
      .select()
      .from(incidentUpdates)
      .where(eq(incidentUpdates.incidentId, incidentId))
      .orderBy(desc(incidentUpdates.createdAt));

    // Get affected components
    const affectedComps = await db
      .select({
        id: components.id,
        name: components.name,
        status: components.status,
      })
      .from(incidentComponents)
      .innerJoin(components, eq(incidentComponents.componentId, components.id))
      .where(eq(incidentComponents.incidentId, incidentId));

    return {
      ...incident,
      updates,
      affectedComponents: affectedComps,
    };
  },

  async list(options: {
    status?: "active" | "resolved" | "all";
    severity?: IncidentSeverity;
    limit: number;
    offset: number;
  }) {
    const conditions = [];

    if (options.status === "active") {
      conditions.push(isNull(incidents.resolvedAt));
    } else if (options.status === "resolved") {
      conditions.push(isNotNull(incidents.resolvedAt));
    }

    if (options.severity) {
      conditions.push(eq(incidents.severity, options.severity));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(incidents)
        .where(whereClause)
        .orderBy(desc(incidents.createdAt))
        .limit(options.limit)
        .offset(options.offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(incidents)
        .where(whereClause),
    ]);

    // Get latest update and affected components for each incident
    const incidentsWithDetails = await Promise.all(
      items.map(async (incident) => {
        const [latestUpdate] = await db
          .select()
          .from(incidentUpdates)
          .where(eq(incidentUpdates.incidentId, incident.id))
          .orderBy(desc(incidentUpdates.createdAt))
          .limit(1);

        const affectedComps = await db
          .select({
            id: components.id,
            name: components.name,
          })
          .from(incidentComponents)
          .innerJoin(components, eq(incidentComponents.componentId, components.id))
          .where(eq(incidentComponents.incidentId, incident.id));

        return {
          ...incident,
          latestUpdate: latestUpdate || null,
          affectedComponents: affectedComps,
        };
      })
    );

    return {
      incidents: incidentsWithDetails,
      pagination: {
        total: Number(countResult[0]?.count || 0),
        limit: options.limit,
        offset: options.offset,
      },
    };
  },

  async update(incidentId: string, data: { title?: string; severity?: IncidentSeverity }) {
    const [updated] = await db
      .update(incidents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(incidents.id, incidentId))
      .returning();

    if (updated) {
      await invalidateCache();
    }

    return updated;
  },

  async updateAffectedComponents(incidentId: string, componentIds: string[]) {
    return await db.transaction(async (tx) => {
      // Verify incident
      const [incident] = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);

      if (!incident) {
        throw new Error("Incident not found");
      }

      // Get current affected components to restore their status
      const currentAffected = await tx
        .select({ componentId: incidentComponents.componentId })
        .from(incidentComponents)
        .where(eq(incidentComponents.incidentId, incidentId));

      const currentIds = currentAffected.map((c) => c.componentId);

      // Restore status for components being removed (if incident is still active)
      if (!incident.resolvedAt && currentIds.length > 0) {
        const idsToRestore = currentIds.filter((id) => !componentIds.includes(id));
        if (idsToRestore.length > 0) {
          await tx
            .update(components)
            .set({ status: "operational", updatedAt: new Date() })
            .where(inArray(components.id, idsToRestore));
        }
      }

      // Remove existing links
      await tx.delete(incidentComponents).where(eq(incidentComponents.incidentId, incidentId));

      // Add new links
      if (componentIds.length > 0) {
        await tx.insert(incidentComponents).values(
          componentIds.map((componentId) => ({
            incidentId,
            componentId,
          }))
        );

        // Update new component statuses if incident is still active
        if (!incident.resolvedAt) {
          const componentStatus = severityToComponentStatus(incident.severity);
          await tx
            .update(components)
            .set({ status: componentStatus, updatedAt: new Date() })
            .where(inArray(components.id, componentIds));
        }
      }

      await invalidateCache();

      return { success: true };
    });
  },

  async delete(incidentId: string) {
    return await db.transaction(async (tx) => {
      // Get incident to check if it exists and get affected components
      const [incident] = await tx
        .select()
        .from(incidents)
        .where(eq(incidents.id, incidentId))
        .limit(1);

      if (!incident) {
        return null;
      }

      // If incident is not resolved, restore component status
      if (!incident.resolvedAt) {
        const affectedComps = await tx
          .select({ componentId: incidentComponents.componentId })
          .from(incidentComponents)
          .where(eq(incidentComponents.incidentId, incidentId));

        const componentIds = affectedComps.map((c) => c.componentId);
        if (componentIds.length > 0) {
          await tx
            .update(components)
            .set({ status: "operational", updatedAt: new Date() })
            .where(inArray(components.id, componentIds));
        }
      }

      // Delete incident (cascades to updates and components)
      await tx.delete(incidents).where(eq(incidents.id, incidentId));

      await invalidateCache();

      return { success: true };
    });
  },

  // Auto-incident from monitor failure
  async createFromMonitorFailure(data: {
    monitorId: string;
    componentId: string;
    componentName: string;
    errorMessage: string;
  }) {
    // Check if there's already an active incident for this monitor
    const [existing] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.triggeredByMonitorId, data.monitorId), isNull(incidents.resolvedAt)))
      .limit(1);

    if (existing) {
      // Add update to existing incident
      await this.addUpdate({
        incidentId: existing.id,
        status: "investigating",
        message: `Monitor continues to report failures: ${data.errorMessage}`,
      });
      return existing;
    }

    // Create new incident
    return this.create({
      title: `${data.componentName} is experiencing issues`,
      severity: "major",
      status: "investigating",
      message: `Automated alert: ${data.errorMessage}`,
      componentIds: [data.componentId],
      triggeredByMonitorId: data.monitorId,
    });
  },

  // Auto-resolve when monitor recovers
  async resolveFromMonitorRecovery(data: { monitorId: string }) {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.triggeredByMonitorId, data.monitorId), isNull(incidents.resolvedAt)))
      .limit(1);

    if (incident) {
      await this.resolve({
        incidentId: incident.id,
        message: "Automated resolution: Monitor is now healthy.",
      });
      return incident;
    }

    return null;
  },
};
