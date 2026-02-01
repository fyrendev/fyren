import { pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/**
 * System-wide settings table (singleton - only one row)
 *
 * This table stores global configuration that applies to the entire Fyren instance,
 * such as logging configuration. Unlike organization settings, these are system-wide.
 */
export const systemSettings = pgTable("system_settings", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Logging Configuration
  logProvider: varchar("log_provider", { length: 20 }).notNull().default("console"), // console | loki | otlp
  logLevel: varchar("log_level", { length: 10 }).notNull().default("info"), // debug | info | warn | error
  logServiceName: varchar("log_service_name", { length: 100 }).notNull().default("fyren-api"),

  // Loki Configuration
  lokiUrl: varchar("loki_url", { length: 500 }),
  lokiConfig: text("loki_config"), // Encrypted JSON: { username?, password?, tenantId? }

  // OTLP Configuration
  otlpEndpoint: varchar("otlp_endpoint", { length: 500 }),
  otlpConfig: text("otlp_config"), // Encrypted JSON: { headers: Record<string, string> }

  // Metadata
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by"), // User ID who last updated
});

export const insertSystemSettingsSchema = createInsertSchema(systemSettings);
export const selectSystemSettingsSchema = createSelectSchema(systemSettings);

export type SystemSettings = typeof systemSettings.$inferSelect;
export type NewSystemSettings = typeof systemSettings.$inferInsert;
