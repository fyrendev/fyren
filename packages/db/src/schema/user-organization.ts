import { pgTable, uuid, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { users } from "./user";
import { organizations } from "./organization";
import { orgRoleEnum } from "./enums";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Junction table linking users to organizations with roles
export const userOrganizations = pgTable(
  "user_organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: orgRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique("user_org_unique").on(table.userId, table.organizationId),
    index("user_org_user_id_idx").on(table.userId),
    index("user_org_org_id_idx").on(table.organizationId),
  ]
);

export const insertUserOrganizationSchema = createInsertSchema(userOrganizations);
export const selectUserOrganizationSchema = createSelectSchema(userOrganizations);

export type UserOrganization = typeof userOrganizations.$inferSelect;
export type NewUserOrganization = typeof userOrganizations.$inferInsert;
