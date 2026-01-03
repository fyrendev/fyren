-- Add email configuration fields to organizations table
ALTER TABLE "organizations" ADD COLUMN "email_provider" varchar(20) NOT NULL DEFAULT 'console';
ALTER TABLE "organizations" ADD COLUMN "email_from_address" varchar(255);
ALTER TABLE "organizations" ADD COLUMN "email_config" text;
