ALTER TABLE "organization_invites" DROP CONSTRAINT "organization_invites_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_invites" ALTER COLUMN "invited_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;