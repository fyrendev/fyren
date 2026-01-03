import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";
import { subscribers } from "./subscriber";

export const subscriberGroups = pgTable(
  "subscriber_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),

    // Components this group is subscribed to (null = all components)
    componentIds: jsonb("component_ids").$type<string[] | null>().default(null),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("subscriber_groups_organization_id_idx").on(table.organizationId),
    index("subscriber_groups_name_idx").on(table.name),
  ]
);

export const subscriberGroupsRelations = relations(subscriberGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [subscriberGroups.organizationId],
    references: [organizations.id],
  }),
  subscribers: many(subscribers),
}));

export const insertSubscriberGroupSchema = createInsertSchema(subscriberGroups);
export const selectSubscriberGroupSchema = createSelectSchema(subscriberGroups);

export type SubscriberGroup = typeof subscriberGroups.$inferSelect;
export type NewSubscriberGroup = typeof subscriberGroups.$inferInsert;
