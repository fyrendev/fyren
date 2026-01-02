import { pgTable, uuid, varchar, timestamp, index, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull().unique(),

    // Branding - Logos
    logoUrl: varchar("logo_url", { length: 500 }),
    logoLightUrl: varchar("logo_light_url", { length: 500 }), // For dark backgrounds
    faviconUrl: varchar("favicon_url", { length: 500 }),

    // Branding - Colors
    brandColor: varchar("brand_color", { length: 7 }),
    accentColor: varchar("accent_color", { length: 7 }),

    // Branding - Custom CSS
    customCss: text("custom_css"),

    // Custom domain
    customDomain: varchar("custom_domain", { length: 255 }).unique(),
    customDomainVerified: boolean("custom_domain_verified").default(false),

    // SEO / Meta
    metaTitle: varchar("meta_title", { length: 100 }),
    metaDescription: varchar("meta_description", { length: 255 }),

    // Social / Support
    twitterHandle: varchar("twitter_handle", { length: 50 }),
    supportUrl: varchar("support_url", { length: 500 }),

    // Settings
    timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("organizations_slug_idx").on(table.slug)]
);

export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
