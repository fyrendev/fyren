import { pgTable, uuid, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { incidentSeverityEnum } from "./enums";

export const incidentTemplates = pgTable("incident_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Database Outage"
  title: varchar("title", { length: 200 }).notNull(), // e.g., "Database connectivity issues"
  severity: incidentSeverityEnum("severity").notNull().default("major"),
  // Default first update message
  initialMessage: text("initial_message"),
  // Default component IDs to mark as affected
  defaultComponentIds: jsonb("default_component_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIncidentTemplateSchema = createInsertSchema(incidentTemplates);
export const selectIncidentTemplateSchema = createSelectSchema(incidentTemplates);

export type IncidentTemplate = typeof incidentTemplates.$inferSelect;
export type NewIncidentTemplate = typeof incidentTemplates.$inferInsert;
