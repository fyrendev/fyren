import { Hono } from "hono";
import { MaintenanceService } from "../../services/maintenance.service";
import {
  createMaintenanceSchema,
  updateMaintenanceSchema,
  listMaintenanceSchema,
} from "../../validators/maintenance";
import { NotFoundError, BadRequestError, errorResponse } from "../../lib/errors";

export const adminMaintenance = new Hono();

// GET /api/v1/admin/maintenance - List maintenance windows
adminMaintenance.get("/", async (c) => {
  try {
    const query = listMaintenanceSchema.parse({
      status: c.req.query("status"),
      upcoming: c.req.query("upcoming"),
      limit: c.req.query("limit"),
      offset: c.req.query("offset"),
    });

    const result = await MaintenanceService.list(query);

    return c.json({
      maintenances: result.maintenances.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        status: m.status,
        affectedComponents: m.affectedComponents,
        scheduledStartAt: m.scheduledStartAt.toISOString(),
        scheduledEndAt: m.scheduledEndAt.toISOString(),
        startedAt: m.startedAt?.toISOString() || null,
        completedAt: m.completedAt?.toISOString() || null,
        autoStart: m.autoStart,
        autoComplete: m.autoComplete,
        createdBy: m.createdBy,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
      pagination: result.pagination,
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/admin/maintenance/:id - Get single maintenance
adminMaintenance.get("/:id", async (c) => {
  try {
    const maintenanceId = c.req.param("id");
    const maintenance = await MaintenanceService.getById(maintenanceId);

    if (!maintenance) {
      throw new NotFoundError("Maintenance not found");
    }

    return c.json({
      maintenance: {
        id: maintenance.id,
        title: maintenance.title,
        description: maintenance.description,
        status: maintenance.status,
        affectedComponents: maintenance.affectedComponents,
        scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
        scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
        startedAt: maintenance.startedAt?.toISOString() || null,
        completedAt: maintenance.completedAt?.toISOString() || null,
        autoStart: maintenance.autoStart,
        autoComplete: maintenance.autoComplete,
        createdBy: maintenance.createdBy,
        createdAt: maintenance.createdAt.toISOString(),
        updatedAt: maintenance.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/maintenance - Create maintenance
adminMaintenance.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = createMaintenanceSchema.parse(body);

    const maintenance = await MaintenanceService.create({
      title: data.title,
      description: data.description,
      scheduledStartAt: new Date(data.scheduledStartAt),
      scheduledEndAt: new Date(data.scheduledEndAt),
      componentIds: data.componentIds,
      autoStart: data.autoStart,
      autoComplete: data.autoComplete,
      createdBy: user?.id,
    });

    return c.json(
      {
        maintenance: {
          id: maintenance.id,
          title: maintenance.title,
          description: maintenance.description,
          status: maintenance.status,
          scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
          scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
          startedAt: maintenance.startedAt?.toISOString() || null,
          completedAt: maintenance.completedAt?.toISOString() || null,
          autoStart: maintenance.autoStart,
          autoComplete: maintenance.autoComplete,
          createdBy: maintenance.createdBy,
          createdAt: maintenance.createdAt.toISOString(),
          updatedAt: maintenance.updatedAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/maintenance/:id - Update maintenance
adminMaintenance.put("/:id", async (c) => {
  try {
    const maintenanceId = c.req.param("id");
    const body = await c.req.json();
    const data = updateMaintenanceSchema.parse(body);

    const maintenance = await MaintenanceService.update(maintenanceId, {
      title: data.title,
      description: data.description,
      scheduledStartAt: data.scheduledStartAt ? new Date(data.scheduledStartAt) : undefined,
      scheduledEndAt: data.scheduledEndAt ? new Date(data.scheduledEndAt) : undefined,
      componentIds: data.componentIds,
      autoStart: data.autoStart,
      autoComplete: data.autoComplete,
    });

    return c.json({
      maintenance: {
        id: maintenance.id,
        title: maintenance.title,
        description: maintenance.description,
        status: maintenance.status,
        scheduledStartAt: maintenance.scheduledStartAt.toISOString(),
        scheduledEndAt: maintenance.scheduledEndAt.toISOString(),
        startedAt: maintenance.startedAt?.toISOString() || null,
        completedAt: maintenance.completedAt?.toISOString() || null,
        autoStart: maintenance.autoStart,
        autoComplete: maintenance.autoComplete,
        createdBy: maintenance.createdBy,
        createdAt: maintenance.createdAt.toISOString(),
        updatedAt: maintenance.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Maintenance not found") {
        return errorResponse(c, new NotFoundError("Maintenance not found"));
      }
      if (error.message === "Can only update scheduled maintenance") {
        return errorResponse(c, new BadRequestError(error.message));
      }
    }
    return errorResponse(c, error);
  }
});

// PATCH /api/v1/admin/maintenance/:id/start - Start maintenance early
adminMaintenance.patch("/:id/start", async (c) => {
  try {
    const maintenanceId = c.req.param("id");
    const maintenance = await MaintenanceService.start(maintenanceId);

    if (!maintenance) {
      throw new NotFoundError("Maintenance not found");
    }

    return c.json({
      maintenance: {
        id: maintenance.id,
        title: maintenance.title,
        status: maintenance.status,
        startedAt: maintenance.startedAt?.toISOString() || null,
        updatedAt: maintenance.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Maintenance not found") {
        return errorResponse(c, new NotFoundError("Maintenance not found"));
      }
      if (error.message === "Maintenance is not in scheduled status") {
        return errorResponse(c, new BadRequestError(error.message));
      }
    }
    return errorResponse(c, error);
  }
});

// PATCH /api/v1/admin/maintenance/:id/complete - Complete maintenance
adminMaintenance.patch("/:id/complete", async (c) => {
  try {
    const maintenanceId = c.req.param("id");
    const maintenance = await MaintenanceService.complete(maintenanceId);

    if (!maintenance) {
      throw new NotFoundError("Maintenance not found");
    }

    return c.json({
      maintenance: {
        id: maintenance.id,
        title: maintenance.title,
        status: maintenance.status,
        completedAt: maintenance.completedAt?.toISOString() || null,
        updatedAt: maintenance.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Maintenance not found") {
        return errorResponse(c, new NotFoundError("Maintenance not found"));
      }
      if (error.message === "Maintenance is not in progress") {
        return errorResponse(c, new BadRequestError(error.message));
      }
    }
    return errorResponse(c, error);
  }
});

// DELETE /api/v1/admin/maintenance/:id - Cancel maintenance
adminMaintenance.delete("/:id", async (c) => {
  try {
    const maintenanceId = c.req.param("id");
    await MaintenanceService.cancel(maintenanceId);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Maintenance not found") {
        return errorResponse(c, new NotFoundError("Maintenance not found"));
      }
      if (error.message === "Maintenance is already completed or cancelled") {
        return errorResponse(c, new BadRequestError(error.message));
      }
    }
    return errorResponse(c, error);
  }
});
