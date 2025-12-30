import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./user";
import { organizations } from "./organization";
import { inviteRoleEnum } from "./enums";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Pending invitations to join an organization
export const organizationInvites = pgTable(
  "organization_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: inviteRoleEnum("role").notNull().default("member"),
    token: text("token").notNull().unique(),
    invitedBy: text("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("org_invite_token_idx").on(table.token),
    index("org_invite_email_idx").on(table.email),
    index("org_invite_org_id_idx").on(table.organizationId),
  ]
);

export const insertOrganizationInviteSchema = createInsertSchema(organizationInvites);
export const selectOrganizationInviteSchema = createSelectSchema(organizationInvites);

export type OrganizationInvite = typeof organizationInvites.$inferSelect;
export type NewOrganizationInvite = typeof organizationInvites.$inferInsert;
