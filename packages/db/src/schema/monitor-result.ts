import {
  pgTable,
  uuid,
  integer,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { monitors } from "./monitor";
import { monitorResultStatusEnum } from "./enums";

export const monitorResults = pgTable(
  "monitor_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monitorId: uuid("monitor_id")
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    status: monitorResultStatusEnum("status").notNull(),
    responseTimeMs: integer("response_time_ms"),
    statusCode: integer("status_code"),
    errorMessage: varchar("error_message", { length: 1000 }),
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
  },
  (table) => [
    index("monitor_results_monitor_id_idx").on(table.monitorId),
    index("monitor_results_checked_at_idx").on(table.checkedAt),
  ]
);

export const insertMonitorResultSchema = createInsertSchema(monitorResults);
export const selectMonitorResultSchema = createSelectSchema(monitorResults);

export type MonitorResult = typeof monitorResults.$inferSelect;
export type NewMonitorResult = typeof monitorResults.$inferInsert;
