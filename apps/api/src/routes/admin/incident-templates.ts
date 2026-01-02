import { Hono } from "hono";
import { db } from "../../lib/db";
import { incidentTemplates, eq, and } from "@fyrendev/db";
import { IncidentService } from "../../services/incident.service";
import {
  createTemplateSchema,
  updateTemplateSchema,
  createFromTemplateSchema,
} from "../../validators/incident";
import { ValidationError, NotFoundError, errorResponse } from "../../lib/errors";

export const adminIncidentTemplates = new Hono();

// GET /api/v1/admin/incident-templates - List templates
adminIncidentTemplates.get("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const templates = await db
      .select()
      .from(incidentTemplates)
      .where(eq(incidentTemplates.organizationId, orgId))
      .orderBy(incidentTemplates.name);

    return c.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        title: t.title,
        severity: t.severity,
        initialMessage: t.initialMessage,
        defaultComponentIds: t.defaultComponentIds,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/admin/incident-templates/:id - Get single template
adminIncidentTemplates.get("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const templateId = c.req.param("id");

    const [template] = await db
      .select()
      .from(incidentTemplates)
      .where(and(eq(incidentTemplates.id, templateId), eq(incidentTemplates.organizationId, orgId)))
      .limit(1);

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    return c.json({
      template: {
        id: template.id,
        name: template.name,
        title: template.title,
        severity: template.severity,
        initialMessage: template.initialMessage,
        defaultComponentIds: template.defaultComponentIds,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/incident-templates - Create template
adminIncidentTemplates.post("/", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const body = await c.req.json();
    const data = createTemplateSchema.parse(body);

    const [template] = await db
      .insert(incidentTemplates)
      .values({
        organizationId: orgId,
        name: data.name,
        title: data.title,
        severity: data.severity,
        initialMessage: data.initialMessage,
        defaultComponentIds: data.defaultComponentIds,
      })
      .returning();

    if (!template) {
      throw new Error("Failed to create template");
    }

    return c.json(
      {
        template: {
          id: template.id,
          name: template.name,
          title: template.title,
          severity: template.severity,
          initialMessage: template.initialMessage,
          defaultComponentIds: template.defaultComponentIds,
          createdAt: template.createdAt.toISOString(),
          updatedAt: template.updatedAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/incident-templates/:id - Update template
adminIncidentTemplates.put("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const templateId = c.req.param("id");
    const body = await c.req.json();
    const data = updateTemplateSchema.parse(body);

    const [template] = await db
      .update(incidentTemplates)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(incidentTemplates.id, templateId), eq(incidentTemplates.organizationId, orgId)))
      .returning();

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    return c.json({
      template: {
        id: template.id,
        name: template.name,
        title: template.title,
        severity: template.severity,
        initialMessage: template.initialMessage,
        defaultComponentIds: template.defaultComponentIds,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// DELETE /api/v1/admin/incident-templates/:id - Delete template
adminIncidentTemplates.delete("/:id", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const templateId = c.req.param("id");

    const [deleted] = await db
      .delete(incidentTemplates)
      .where(and(eq(incidentTemplates.id, templateId), eq(incidentTemplates.organizationId, orgId)))
      .returning();

    if (!deleted) {
      throw new NotFoundError("Template not found");
    }

    return c.json({ success: true });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/incident-templates/:id/create-incident - Create incident from template
adminIncidentTemplates.post("/:id/create-incident", async (c) => {
  try {
    const orgId = c.get("organizationId");
    if (!orgId) {
      throw new ValidationError("Organization ID required");
    }

    const templateId = c.req.param("id");
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const overrides = createFromTemplateSchema.parse(body);

    const [template] = await db
      .select()
      .from(incidentTemplates)
      .where(and(eq(incidentTemplates.id, templateId), eq(incidentTemplates.organizationId, orgId)))
      .limit(1);

    if (!template) {
      throw new NotFoundError("Template not found");
    }

    const incident = await IncidentService.create({
      organizationId: orgId,
      title: overrides.title || template.title,
      severity: template.severity,
      status: "investigating",
      message:
        overrides.message ||
        template.initialMessage ||
        `Incident created from template: ${template.name}`,
      componentIds: overrides.componentIds || template.defaultComponentIds || [],
      createdBy: user?.id,
    });

    if (!incident) {
      throw new Error("Failed to create incident from template");
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
