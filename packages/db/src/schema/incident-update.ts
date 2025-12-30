import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { incidents } from "./incident";
import { users } from "./user";
import { incidentStatusEnum } from "./enums";

export const incidentUpdates = pgTable(
  "incident_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    status: incidentStatusEnum("status").notNull(),
    message: text("message").notNull(),
    // Who posted this update (null for auto-generated updates)
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("incident_updates_incident_id_idx").on(table.incidentId),
    index("incident_updates_created_at_idx").on(table.createdAt),
  ]
);

export const insertIncidentUpdateSchema = createInsertSchema(incidentUpdates);
export const selectIncidentUpdateSchema = createSelectSchema(incidentUpdates);

export type IncidentUpdate = typeof incidentUpdates.$inferSelect;
export type NewIncidentUpdate = typeof incidentUpdates.$inferInsert;
