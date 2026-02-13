-- Add role column to users first
ALTER TABLE "users" ADD COLUMN "role" "org_role";--> statement-breakpoint

-- Migrate roles from user_organizations to users before dropping the table
UPDATE "users" SET "role" = uo."role"
FROM "user_organizations" uo
WHERE "users"."id" = uo."user_id";--> statement-breakpoint

-- Now safe to drop user_organizations
ALTER TABLE "user_organizations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "user_organizations" CASCADE;--> statement-breakpoint

-- Drop org FK constraints
ALTER TABLE "subscribers" DROP CONSTRAINT "subscribers_org_email_unique";--> statement-breakpoint
ALTER TABLE "organization_invites" DROP CONSTRAINT "organization_invites_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "components" DROP CONSTRAINT "components_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "incidents" DROP CONSTRAINT "incidents_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "incident_templates" DROP CONSTRAINT "incident_templates_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "maintenances" DROP CONSTRAINT "maintenances_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriber_groups" DROP CONSTRAINT "subscriber_groups_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "subscribers" DROP CONSTRAINT "subscribers_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" DROP CONSTRAINT "webhook_endpoints_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_logs" DROP CONSTRAINT "notification_logs_organization_id_organizations_id_fk";
--> statement-breakpoint

-- Drop org indexes
DROP INDEX "org_invite_org_id_idx";--> statement-breakpoint
DROP INDEX "components_organization_id_idx";--> statement-breakpoint
DROP INDEX "incidents_organization_id_idx";--> statement-breakpoint
DROP INDEX "incident_templates_organization_id_idx";--> statement-breakpoint
DROP INDEX "maintenances_organization_id_idx";--> statement-breakpoint
DROP INDEX "subscriber_groups_organization_id_idx";--> statement-breakpoint
DROP INDEX "subscribers_organization_id_idx";--> statement-breakpoint
DROP INDEX "webhook_endpoints_organization_id_idx";--> statement-breakpoint
DROP INDEX "api_keys_organization_id_idx";--> statement-breakpoint
DROP INDEX "notification_logs_organization_id_idx";--> statement-breakpoint

-- Drop organization_id columns
ALTER TABLE "organization_invites" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "components" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "incidents" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "incident_templates" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "maintenances" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "subscriber_groups" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "subscribers" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "webhook_endpoints" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "notification_logs" DROP COLUMN "organization_id";--> statement-breakpoint

-- New unique constraint on subscribers.email (was org_id + email)
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_email_unique" UNIQUE("email");
