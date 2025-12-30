import { z } from "zod";

export const incidentStatusSchema = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

export const incidentSeveritySchema = z.enum(["minor", "major", "critical"]);

export const createIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  severity: incidentSeveritySchema.optional().default("minor"),
  status: incidentStatusSchema.optional().default("investigating"),
  message: z.string().min(1).max(5000), // Initial update message
  componentIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  severity: incidentSeveritySchema.optional(),
});

export const createIncidentUpdateSchema = z.object({
  status: incidentStatusSchema,
  message: z.string().min(1).max(5000),
});

export const resolveIncidentSchema = z.object({
  message: z.string().min(1).max(5000).optional(),
});

export const listIncidentsSchema = z.object({
  status: z.enum(["active", "resolved", "all"]).optional().default("all"),
  severity: incidentSeveritySchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});

export const updateAffectedComponentsSchema = z.object({
  componentIds: z.array(z.string().uuid()),
});

// Templates
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  severity: incidentSeveritySchema.optional().default("major"),
  initialMessage: z.string().max(5000).optional(),
  defaultComponentIds: z.array(z.string().uuid()).optional().default([]),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createFromTemplateSchema = z.object({
  title: z.string().min(1).max(200).optional(), // Override template title
  message: z.string().min(1).max(5000).optional(), // Override initial message
  componentIds: z.array(z.string().uuid()).optional(), // Override components
});

// Type exports
export type CreateIncident = z.infer<typeof createIncidentSchema>;
export type UpdateIncident = z.infer<typeof updateIncidentSchema>;
export type CreateIncidentUpdate = z.infer<typeof createIncidentUpdateSchema>;
export type ResolveIncident = z.infer<typeof resolveIncidentSchema>;
export type ListIncidents = z.infer<typeof listIncidentsSchema>;
export type CreateTemplate = z.infer<typeof createTemplateSchema>;
export type UpdateTemplate = z.infer<typeof updateTemplateSchema>;
export type CreateFromTemplate = z.infer<typeof createFromTemplateSchema>;
