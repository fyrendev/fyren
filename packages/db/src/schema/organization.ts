import { pgTable, uuid, varchar, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),

    // Branding - Logos
    logoUrl: varchar("logo_url", { length: 500 }),
    logoLightUrl: varchar("logo_light_url", { length: 500 }), // For dark backgrounds
    faviconUrl: varchar("favicon_url", { length: 500 }),

    // Branding - Colors
    brandColor: varchar("brand_color", { length: 7 }),
    accentColor: varchar("accent_color", { length: 7 }),
    backgroundColor: varchar("background_color", { length: 7 }),
    textColor: varchar("text_color", { length: 7 }),

    // Branding - Custom CSS
    customCss: text("custom_css"),

    // SEO / Meta
    metaTitle: varchar("meta_title", { length: 100 }),
    metaDescription: varchar("meta_description", { length: 255 }),

    // Social / Support
    twitterHandle: varchar("twitter_handle", { length: 50 }),
    supportUrl: varchar("support_url", { length: 500 }),

    // Settings
    timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),

    // Security: allowed origins for widget embedding (CSP frame-ancestors)
    // Space-separated list, e.g. "https://example.com https://other.com"
    // Defaults to "*" (allow all) when null
    widgetAllowedOrigins: varchar("widget_allowed_origins", { length: 2000 }),

    // Email Configuration
    emailProvider: varchar("email_provider", { length: 20 }).notNull().default("console"), // console, smtp, sendgrid, ses
    emailFromAddress: varchar("email_from_address", { length: 255 }),
    emailConfig: text("email_config"), // Encrypted JSON with provider-specific settings

    // Timestamps
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  () => []
);

export const insertOrganizationSchema = createInsertSchema(organizations);
export const selectOrganizationSchema = createSelectSchema(organizations);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
