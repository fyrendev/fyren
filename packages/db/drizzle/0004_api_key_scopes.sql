CREATE TYPE "public"."api_key_scope" AS ENUM('read', 'read-write', 'full-access');--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "scope" "api_key_scope" DEFAULT 'read-write' NOT NULL;--> statement-breakpoint
UPDATE "api_keys" SET "scope" = CASE
  WHEN "role" = 'owner' THEN 'full-access'::"api_key_scope"
  WHEN "role" = 'admin' THEN 'read-write'::"api_key_scope"
  WHEN "role" = 'member' THEN 'read'::"api_key_scope"
  ELSE 'read-write'::"api_key_scope"
END;--> statement-breakpoint
ALTER TABLE "api_keys" DROP COLUMN "role";