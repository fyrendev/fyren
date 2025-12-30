import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    email: text("email").notNull(),

    // Verification
    verified: boolean("verified").notNull().default(false),
    verificationToken: text("verification_token"),
    verifiedAt: timestamp("verified_at"),

    // Unsubscribe token (always valid, for one-click unsubscribe)
    unsubscribeToken: text("unsubscribe_token").notNull(),

    // Optional: subscribe to specific components only (null = all)
    componentIds: jsonb("component_ids").$type<string[] | null>().default(null),

    // Preferences
    notifyOnIncident: boolean("notify_on_incident").notNull().default(true),
    notifyOnMaintenance: boolean("notify_on_maintenance").notNull().default(true),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("subscribers_organization_id_idx").on(table.organizationId),
    index("subscribers_email_idx").on(table.email),
    index("subscribers_verification_token_idx").on(table.verificationToken),
    index("subscribers_unsubscribe_token_idx").on(table.unsubscribeToken),
    unique("subscribers_org_email_unique").on(table.organizationId, table.email),
  ]
);

export const subscribersRelations = relations(subscribers, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscribers.organizationId],
    references: [organizations.id],
  }),
}));

export const insertSubscriberSchema = createInsertSchema(subscribers);
export const selectSubscriberSchema = createSelectSchema(subscribers);

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;
