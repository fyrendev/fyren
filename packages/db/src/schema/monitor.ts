import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { components } from "./component";
import { monitorTypeEnum } from "./enums";

export const monitors = pgTable(
  "monitors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    componentId: uuid("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    type: monitorTypeEnum("type").notNull(),
    url: varchar("url", { length: 2000 }).notNull(),
    intervalSeconds: integer("interval_seconds").notNull().default(60),
    timeoutMs: integer("timeout_ms").notNull().default(10000),
    expectedStatusCode: integer("expected_status_code"),
    headers: jsonb("headers").$type<Record<string, string>>(),
    failureThreshold: integer("failure_threshold").notNull().default(3),
    isActive: boolean("is_active").notNull().default(true),
    // Auto-incident creation on monitor failure
    createIncidentOnFailure: boolean("create_incident_on_failure").notNull().default(false),
    autoResolveIncident: boolean("auto_resolve_incident").notNull().default(true),
    lastCheckedAt: timestamp("last_checked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("monitors_component_id_idx").on(table.componentId),
    index("monitors_is_active_idx").on(table.isActive),
  ]
);

export const insertMonitorSchema = createInsertSchema(monitors);
export const selectMonitorSchema = createSelectSchema(monitors);

export type Monitor = typeof monitors.$inferSelect;
export type NewMonitor = typeof monitors.$inferInsert;
