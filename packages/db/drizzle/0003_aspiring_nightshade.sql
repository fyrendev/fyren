ALTER TABLE "organizations" DROP CONSTRAINT "organizations_custom_domain_unique";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "custom_domain";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "custom_domain_verified";