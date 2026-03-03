import { z } from "zod";

export const maintenanceStatusSchema = z.enum([
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const createMaintenanceSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    scheduledStartAt: z.string().datetime(),
    scheduledEndAt: z.string().datetime(),
    componentIds: z.array(z.string().uuid()).min(1, "At least one component required"),
    autoStart: z.boolean().optional().default(true),
    autoComplete: z.boolean().optional().default(true),
  })
  .refine((data) => new Date(data.scheduledEndAt) > new Date(data.scheduledStartAt), {
    message: "End time must be after start time",
    path: ["scheduledEndAt"],
  })
  .refine((data) => new Date(data.scheduledStartAt) > new Date(), {
    message: "Start time must be in the future",
    path: ["scheduledStartAt"],
  });

export const updateMaintenanceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  scheduledStartAt: z.string().datetime().optional(),
  scheduledEndAt: z.string().datetime().optional(),
  componentIds: z.array(z.string().uuid()).optional(),
  autoStart: z.boolean().optional(),
  autoComplete: z.boolean().optional(),
});

export const listMaintenanceSchema = z.object({
  status: maintenanceStatusSchema.optional(),
  upcoming: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
});
