-- Create subscriber_groups table
CREATE TABLE IF NOT EXISTS "subscriber_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"component_ids" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign key constraint for organization
DO $$ BEGIN
 ALTER TABLE "subscriber_groups" ADD CONSTRAINT "subscriber_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add indexes for subscriber_groups
CREATE INDEX IF NOT EXISTS "subscriber_groups_organization_id_idx" ON "subscriber_groups" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriber_groups_name_idx" ON "subscriber_groups" USING btree ("name");
--> statement-breakpoint

-- Add group_id column to subscribers table
ALTER TABLE "subscribers" ADD COLUMN "group_id" uuid;
--> statement-breakpoint

-- Add foreign key constraint for group_id
DO $$ BEGIN
 ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_group_id_subscriber_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."subscriber_groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add index on group_id
CREATE INDEX IF NOT EXISTS "subscribers_group_id_idx" ON "subscribers" USING btree ("group_id");
