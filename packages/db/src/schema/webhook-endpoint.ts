import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { webhookTypeEnum } from "./enums";

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    name: text("name").notNull(), // e.g., "#incidents channel"
    type: webhookTypeEnum("type").notNull(),
    url: text("url").notNull(),

    // Optional secret for signature verification (generic webhooks)
    secret: text("secret"),

    // What to notify about
    notifyOnIncident: boolean("notify_on_incident").notNull().default(true),
    notifyOnMaintenance: boolean("notify_on_maintenance").notNull().default(true),
    notifyOnComponentChange: boolean("notify_on_component_change").notNull().default(false),

    // Optional: filter to specific components
    componentIds: jsonb("component_ids").$type<string[] | null>().default(null),

    // Status
    enabled: boolean("enabled").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at"),
    lastError: text("last_error"),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("webhook_endpoints_enabled_idx").on(table.enabled)]
);

export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpoints);
export const selectWebhookEndpointSchema = createSelectSchema(webhookEndpoints);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
