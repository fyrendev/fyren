CREATE TABLE "incident_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"title" varchar(200) NOT NULL,
	"severity" "incident_severity" DEFAULT 'major' NOT NULL,
	"initial_message" text,
	"default_component_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "create_incident_on_failure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "auto_resolve_incident" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "triggered_by_monitor_id" uuid;--> statement-breakpoint
ALTER TABLE "incident_updates" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "incident_templates" ADD CONSTRAINT "incident_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_templates_organization_id_idx" ON "incident_templates" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_triggered_by_monitor_id_monitors_id_fk" FOREIGN KEY ("triggered_by_monitor_id") REFERENCES "public"."monitors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_updates" ADD CONSTRAINT "incident_updates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidents_triggered_by_monitor_id_idx" ON "incidents" USING btree ("triggered_by_monitor_id");