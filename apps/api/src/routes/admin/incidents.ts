import { Hono } from "hono";
import { IncidentService } from "../../services/incident.service";
import {
  createIncidentSchema,
  updateIncidentSchema,
  createIncidentUpdateSchema,
  resolveIncidentSchema,
  listIncidentsSchema,
  updateAffectedComponentsSchema,
} from "../../validators/incident";
import {
  ValidationError,
  NotFoundError,
  errorResponse,
} from "../../lib/errors";

export const adminIncidents = new Hono();

// GET /api/v1/admin/incidents - List incidents
adminIncidents.get("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const query = listIncidentsSchema.parse({
      status: c.req.query("status"),
      severity: c.req.query("severity"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });

    const result = await IncidentService.list(orgId, query);

    return c.json({
      incidents: result.incidents.map((incident) => ({
        id: incident.id,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        affectedComponents: incident.affectedComponents,
        latestUpdate: incident.latestUpdate
          ? {
              id: incident.latestUpdate.id,
              status: incident.latestUpdate.status,
              message: incident.latestUpdate.message,
              createdAt: incident.latestUpdate.createdAt.toISOString(),
            }
          : null,
        triggeredByMonitorId: incident.triggeredByMonitorId,
        startedAt: incident.startedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/admin/incidents/:id - Get single incident
adminIncidents.get("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const incidentId = c.req.param("id");
    const incident = await IncidentService.getById(incidentId, orgId);

    if (!incident) {
      throw new NotFoundError("Incident not found");
    }

    return c.json({
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        affectedComponents: incident.affectedComponents,
        updates: incident.updates.map((u) => ({
          id: u.id,
          status: u.status,
          message: u.message,
          createdBy: u.createdBy,
          createdAt: u.createdAt.toISOString(),
        })),
        triggeredByMonitorId: incident.triggeredByMonitorId,
        startedAt: incident.startedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/incidents - Create incident
adminIncidents.post("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const user = c.get("user");
    const body = await c.req.json();
    const data = createIncidentSchema.parse(body);

    const incident = await IncidentService.create({
      organizationId: orgId,
      title: data.title,
      severity: data.severity,
      status: data.status,
      message: data.message,
      componentIds: data.componentIds,
      createdBy: user?.id,
    });

    if (!incident) {
      throw new Error("Failed to create incident");
    }

    return c.json(
      {
        incident: {
          id: incident.id,
          title: incident.title,
          status: incident.status,
          severity: incident.severity,
          triggeredByMonitorId: incident.triggeredByMonitorId,
          startedAt: incident.startedAt.toISOString(),
          resolvedAt: incident.resolvedAt?.toISOString() || null,
          createdAt: incident.createdAt.toISOString(),
          updatedAt: incident.updatedAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/incidents/:id - Update incident metadata (title, severity)
adminIncidents.put("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const incidentId = c.req.param("id");
    const body = await c.req.json();
    const data = updateIncidentSchema.parse(body);

    const incident = await IncidentService.update(incidentId, orgId, data);

    if (!incident) {
      throw new NotFoundError("Incident not found");
    }

    return c.json({
      incident: {
        id: incident.id,
        title: incident.title,
        status: incident.status,
        severity: incident.severity,
        triggeredByMonitorId: incident.triggeredByMonitorId,
        startedAt: incident.startedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() || null,
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/incidents/:id/updates - Add update to incident
adminIncidents.post("/:id/updates", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const incidentId = c.req.param("id");
    const user = c.get("user");
    const body = await c.req.json();
    const data = createIncidentUpdateSchema.parse(body);

    const update = await IncidentService.addUpdate({
      incidentId,
      organizationId: orgId,
      status: data.status,
      message: data.message,
      createdBy: user?.id,
    });

    if (!update) {
      throw new Error("Failed to create incident update");
    }

    return c.json(
      {
        update: {
          id: update.id,
          status: update.status,
          message: update.message,
          createdBy: update.createdBy,
          createdAt: update.createdAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Incident not found") {
      return errorResponse(c, new NotFoundError("Incident not found"));
    }
    return errorResponse(c, error);
  }
});

// PATCH /api/v1/admin/incidents/:id/resolve - Resolve incident (shortcut)
adminIncidents.patch("/:id/resolve", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const incidentId = c.req.param("id");
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const data = resolveIncidentSchema.parse(body);

    const update = await IncidentService.resolve({
      incidentId,
      organizationId: orgId,
      message: data.message,
      createdBy: user?.id,
    });

    if (!update) {
      throw new Error("Failed to resolve incident");
    }

    return c.json({
      update: {
        id: update.id,
        status: update.status,
        message: update.message,
        createdBy: update.createdBy,
        createdAt: update.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Incident not found") {
      return errorResponse(c, new NotFoundError("Incident not found"));
    }
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/incidents/:id/components - Update affected components
adminIncidents.put("/:id/components", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const incidentId = c.req.param("id");
    const body = await c.req.json();
    const { componentIds } = updateAffectedComponentsSchema.parse(body);

    await IncidentService.updateAffectedComponents(
      incidentId,
      orgId,
      componentIds
    );

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Incident not found") {
      return errorResponse(c, new NotFoundError("Incident not found"));
    }
    return errorResponse(c, error);
  }
});

// DELETE /api/v1/admin/incidents/:id - Delete incident
adminIncidents.delete("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const incidentId = c.req.param("id");
    const result = await IncidentService.delete(incidentId, orgId);

    if (!result) {
      throw new NotFoundError("Incident not found");
    }

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});
