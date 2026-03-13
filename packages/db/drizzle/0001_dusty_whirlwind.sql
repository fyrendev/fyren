ALTER TABLE "organizations" DROP CONSTRAINT "organizations_slug_unique";--> statement-breakpoint
DROP INDEX "organizations_slug_idx";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "slug";