import { pgTable, uuid, text, boolean, timestamp, jsonb, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { subscriberGroups } from "./subscriber-group";

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    email: text("email").notNull(),

    // Optional: belongs to a subscriber group (null = individual subscriber)
    groupId: uuid("group_id").references(() => subscriberGroups.id, { onDelete: "set null" }),

    // Verification
    verified: boolean("verified").notNull().default(false),
    verificationToken: text("verification_token"),
    verifiedAt: timestamp("verified_at"),

    // Unsubscribe token (always valid, for one-click unsubscribe)
    unsubscribeToken: text("unsubscribe_token").notNull(),

    // Optional: subscribe to specific components only (null = all)
    // Note: When subscriber belongs to a group, group's componentIds take precedence
    componentIds: jsonb("component_ids").$type<string[] | null>().default(null),

    // Preferences
    notifyOnIncident: boolean("notify_on_incident").notNull().default(true),
    notifyOnMaintenance: boolean("notify_on_maintenance").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("subscribers_email_idx").on(table.email),
    index("subscribers_group_id_idx").on(table.groupId),
    index("subscribers_verification_token_idx").on(table.verificationToken),
    index("subscribers_unsubscribe_token_idx").on(table.unsubscribeToken),
    unique("subscribers_email_unique").on(table.email),
  ]
);

export const subscribersRelations = relations(subscribers, ({ one }) => ({
  group: one(subscriberGroups, {
    fields: [subscribers.groupId],
    references: [subscriberGroups.id],
  }),
}));

export const insertSubscriberSchema = createInsertSchema(subscribers);
export const selectSubscriberSchema = createSelectSchema(subscribers);

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;
