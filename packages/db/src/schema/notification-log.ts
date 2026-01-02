import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";
import { notificationDeliveryTypeEnum, notificationStatusEnum } from "./enums";

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    type: notificationDeliveryTypeEnum("type").notNull(),
    status: notificationStatusEnum("status").notNull().default("pending"),

    // What triggered this notification
    event: text("event").notNull(), // e.g., 'incident.created', 'maintenance.started'

    // Reference to the entity
    entityType: text("entity_type"), // 'incident', 'maintenance', 'component'
    entityId: uuid("entity_id"),

    // Recipient info
    recipient: text("recipient").notNull(), // email address or webhook URL

    // Payload sent
    payload: jsonb("payload"),

    // Error details if failed
    error: text("error"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"),
  },
  (table) => [
    index("notification_logs_organization_id_idx").on(table.organizationId),
    index("notification_logs_entity_id_idx").on(table.entityId),
    index("notification_logs_status_idx").on(table.status),
    index("notification_logs_event_idx").on(table.event),
    index("notification_logs_created_at_idx").on(table.createdAt),
  ]
);

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [notificationLogs.organizationId],
    references: [organizations.id],
  }),
}));

export const insertNotificationLogSchema = createInsertSchema(notificationLogs);
export const selectNotificationLogSchema = createSelectSchema(notificationLogs);

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type NewNotificationLog = typeof notificationLogs.$inferInsert;
