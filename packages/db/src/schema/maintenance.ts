import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";
import { maintenanceStatusEnum } from "./enums";

export const maintenances = pgTable(
  "maintenances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: maintenanceStatusEnum("status").notNull().default("scheduled"),
    scheduledStart: timestamp("scheduled_start").notNull(),
    scheduledEnd: timestamp("scheduled_end").notNull(),
    actualStart: timestamp("actual_start"),
    actualEnd: timestamp("actual_end"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("maintenances_organization_id_idx").on(table.organizationId),
    index("maintenances_status_idx").on(table.status),
    index("maintenances_scheduled_start_idx").on(table.scheduledStart),
  ]
);

export const insertMaintenanceSchema = createInsertSchema(maintenances);
export const selectMaintenanceSchema = createSelectSchema(maintenances);

export type Maintenance = typeof maintenances.$inferSelect;
export type NewMaintenance = typeof maintenances.$inferInsert;
