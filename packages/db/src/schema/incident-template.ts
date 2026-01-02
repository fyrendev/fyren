import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";
import { incidentSeverityEnum } from "./enums";

export const incidentTemplates = pgTable(
  "incident_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(), // e.g., "Database Outage"
    title: varchar("title", { length: 200 }).notNull(), // e.g., "Database connectivity issues"
    severity: incidentSeverityEnum("severity").notNull().default("major"),
    // Default first update message
    initialMessage: text("initial_message"),
    // Default component IDs to mark as affected
    defaultComponentIds: jsonb("default_component_ids").$type<string[]>().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("incident_templates_organization_id_idx").on(table.organizationId)]
);

export const insertIncidentTemplateSchema = createInsertSchema(incidentTemplates);
export const selectIncidentTemplateSchema = createSelectSchema(incidentTemplates);

export type IncidentTemplate = typeof incidentTemplates.$inferSelect;
export type NewIncidentTemplate = typeof incidentTemplates.$inferInsert;
