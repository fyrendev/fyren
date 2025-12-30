-- Add cancelled to maintenance_status enum
ALTER TYPE "maintenance_status" ADD VALUE 'cancelled';

-- Rename columns in maintenances table
ALTER TABLE "maintenances" RENAME COLUMN "scheduled_start" TO "scheduled_start_at";
ALTER TABLE "maintenances" RENAME COLUMN "scheduled_end" TO "scheduled_end_at";
ALTER TABLE "maintenances" RENAME COLUMN "actual_start" TO "started_at";
ALTER TABLE "maintenances" RENAME COLUMN "actual_end" TO "completed_at";

-- Add new columns to maintenances
ALTER TABLE "maintenances" ADD COLUMN "auto_start" boolean DEFAULT true NOT NULL;
ALTER TABLE "maintenances" ADD COLUMN "auto_complete" boolean DEFAULT true NOT NULL;
ALTER TABLE "maintenances" ADD COLUMN "created_by" text;

-- Add created_at to maintenance_components
ALTER TABLE "maintenance_components" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;

-- Add foreign key for created_by
ALTER TABLE "maintenances" ADD CONSTRAINT "maintenances_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

-- Drop old index and create new one with correct name
DROP INDEX IF EXISTS "maintenances_scheduled_start_idx";
CREATE INDEX "maintenances_scheduled_start_at_idx" ON "maintenances" USING btree ("scheduled_start_at");
