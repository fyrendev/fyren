import { db, organizations, asc } from "@fyrendev/db";
import { NotFoundError } from "./errors";

/**
 * Get the singleton organization for this Fyren instance.
 * Each instance manages exactly one organization.
 */
export async function getOrganization() {
  const [org] = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.createdAt))
    .limit(1);

  if (!org) {
    throw new NotFoundError("No organization configured");
  }

  return org;
}
