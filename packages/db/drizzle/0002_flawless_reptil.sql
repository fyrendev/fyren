ALTER TABLE "organizations" ADD COLUMN "widget_allowed_origins" varchar(2000);--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "role" "org_role" DEFAULT 'admin' NOT NULL;