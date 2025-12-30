import {
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// BetterAuth managed verification table (email verification, password reset)
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(), // Email address
    value: text("value").notNull(), // Token
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
    index("verifications_value_idx").on(table.value),
  ]
);

export const insertVerificationSchema = createInsertSchema(verifications);
export const selectVerificationSchema = createSelectSchema(verifications);

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
