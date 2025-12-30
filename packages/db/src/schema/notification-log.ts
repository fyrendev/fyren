import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";
import {
  notificationTypeEnum,
  notificationChannelEnum,
  notificationStatusEnum,
} from "./enums";

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    referenceId: uuid("reference_id").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    recipient: varchar("recipient", { length: 500 }).notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),
    sentAt: timestamp("sent_at"),
    errorMessage: varchar("error_message", { length: 1000 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("notification_logs_organization_id_idx").on(table.organizationId),
    index("notification_logs_reference_id_idx").on(table.referenceId),
    index("notification_logs_status_idx").on(table.status),
  ]
);

export const insertNotificationLogSchema =
  createInsertSchema(notificationLogs);
export const selectNotificationLogSchema =
  createSelectSchema(notificationLogs);

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type NewNotificationLog = typeof notificationLogs.$inferInsert;
