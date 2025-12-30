import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { organizations } from "./organization";
import { componentStatusEnum } from "./enums";

export const components = pgTable(
  "components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: componentStatusEnum("status").notNull().default("operational"),
    displayOrder: integer("display_order").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("components_organization_id_idx").on(table.organizationId),
    index("components_status_idx").on(table.status),
  ]
);

export const insertComponentSchema = createInsertSchema(components);
export const selectComponentSchema = createSelectSchema(components);

export type Component = typeof components.$inferSelect;
export type NewComponent = typeof components.$inferInsert;
