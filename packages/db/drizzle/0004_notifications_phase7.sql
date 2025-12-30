-- Phase 7: Notifications

-- Create notification_delivery_type enum
CREATE TYPE "notification_delivery_type" AS ENUM ('email', 'webhook');

-- Update subscribers table
ALTER TABLE "subscribers" DROP COLUMN "is_verified";
ALTER TABLE "subscribers" DROP COLUMN "subscribed_at";
ALTER TABLE "subscribers" DROP COLUMN "unsubscribed_at";
ALTER TABLE "subscribers" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "subscribers" ADD COLUMN "verified_at" timestamp;
ALTER TABLE "subscribers" ADD COLUMN "unsubscribe_token" text NOT NULL DEFAULT '';
ALTER TABLE "subscribers" ADD COLUMN "component_ids" jsonb DEFAULT null;
ALTER TABLE "subscribers" ADD COLUMN "notify_on_incident" boolean DEFAULT true NOT NULL;
ALTER TABLE "subscribers" ADD COLUMN "notify_on_maintenance" boolean DEFAULT true NOT NULL;
ALTER TABLE "subscribers" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "subscribers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

-- Add indexes for subscriber tokens
CREATE INDEX "subscribers_verification_token_idx" ON "subscribers" USING btree ("verification_token");
CREATE INDEX "subscribers_unsubscribe_token_idx" ON "subscribers" USING btree ("unsubscribe_token");

-- Update webhook_endpoints table
ALTER TABLE "webhook_endpoints" DROP COLUMN "is_active";
ALTER TABLE "webhook_endpoints" ADD COLUMN "notify_on_incident" boolean DEFAULT true NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN "notify_on_maintenance" boolean DEFAULT true NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN "notify_on_component_change" boolean DEFAULT false NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN "component_ids" jsonb DEFAULT null;
ALTER TABLE "webhook_endpoints" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN "last_triggered_at" timestamp;
ALTER TABLE "webhook_endpoints" ADD COLUMN "last_error" text;
ALTER TABLE "webhook_endpoints" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;

-- Add index for enabled webhooks
CREATE INDEX "webhook_endpoints_enabled_idx" ON "webhook_endpoints" USING btree ("enabled");

-- Update notification_logs table
ALTER TABLE "notification_logs" DROP COLUMN "type";
ALTER TABLE "notification_logs" DROP COLUMN "reference_id";
ALTER TABLE "notification_logs" DROP COLUMN "channel";
ALTER TABLE "notification_logs" DROP COLUMN "error_message";
ALTER TABLE "notification_logs" ADD COLUMN "type" "notification_delivery_type" NOT NULL;
ALTER TABLE "notification_logs" ADD COLUMN "event" text NOT NULL;
ALTER TABLE "notification_logs" ADD COLUMN "entity_type" text;
ALTER TABLE "notification_logs" ADD COLUMN "entity_id" uuid;
ALTER TABLE "notification_logs" ADD COLUMN "payload" jsonb;
ALTER TABLE "notification_logs" ADD COLUMN "error" text;

-- Update notification_logs indexes
DROP INDEX IF EXISTS "notification_logs_reference_id_idx";
CREATE INDEX "notification_logs_entity_id_idx" ON "notification_logs" USING btree ("entity_id");
CREATE INDEX "notification_logs_event_idx" ON "notification_logs" USING btree ("event");
CREATE INDEX "notification_logs_created_at_idx" ON "notification_logs" USING btree ("created_at");

-- Drop old enums
DROP TYPE IF EXISTS "notification_type";
DROP TYPE IF EXISTS "notification_channel";
