import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./user";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// BetterAuth managed account table (for OAuth and credentials)
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(), // e.g., 'credential', 'google'
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"), // Hashed password for credential provider
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    index("accounts_provider_idx").on(table.providerId, table.accountId),
  ]
);

export const insertAccountSchema = createInsertSchema(accounts);
export const selectAccountSchema = createSelectSchema(accounts);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
