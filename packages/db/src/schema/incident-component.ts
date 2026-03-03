import { pgTable, uuid, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { incidents } from "./incident";
import { components } from "./component";

export const incidentComponents = pgTable(
  "incident_components",
  {
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.incidentId, table.componentId] })]
);

export const insertIncidentComponentSchema = createInsertSchema(incidentComponents);
export const selectIncidentComponentSchema = createSelectSchema(incidentComponents);

export type IncidentComponent = typeof incidentComponents.$inferSelect;
export type NewIncidentComponent = typeof incidentComponents.$inferInsert;
