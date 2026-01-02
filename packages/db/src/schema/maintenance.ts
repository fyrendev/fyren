import { pgTable, uuid, varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";
import { users } from "./user";
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

    // Schedule
    scheduledStartAt: timestamp("scheduled_start_at").notNull(),
    scheduledEndAt: timestamp("scheduled_end_at").notNull(),

    // Actual times (may differ from scheduled)
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),

    // Whether to auto-start/complete or require manual action
    autoStart: boolean("auto_start").notNull().default(true),
    autoComplete: boolean("auto_complete").notNull().default(true),

    // Who created
    createdBy: text("created_by").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("maintenances_organization_id_idx").on(table.organizationId),
    index("maintenances_status_idx").on(table.status),
    index("maintenances_scheduled_start_at_idx").on(table.scheduledStartAt),
  ]
);

export const insertMaintenanceSchema = createInsertSchema(maintenances);
export const selectMaintenanceSchema = createSelectSchema(maintenances);

export type Maintenance = typeof maintenances.$inferSelect;
export type NewMaintenance = typeof maintenances.$inferInsert;
