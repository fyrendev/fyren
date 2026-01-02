import { pgTable, uuid, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { maintenances } from "./maintenance";
import { components } from "./component";

export const maintenanceComponents = pgTable(
  "maintenance_components",
  {
    maintenanceId: uuid("maintenance_id")
      .notNull()
      .references(() => maintenances.id, { onDelete: "cascade" }),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.maintenanceId, table.componentId] })]
);

export const insertMaintenanceComponentSchema = createInsertSchema(maintenanceComponents);
export const selectMaintenanceComponentSchema = createSelectSchema(maintenanceComponents);

export type MaintenanceComponent = typeof maintenanceComponents.$inferSelect;
export type NewMaintenanceComponent = typeof maintenanceComponents.$inferInsert;
