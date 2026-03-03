import { db, organizations, asc } from "@fyrendev/db";
import { NotFoundError } from "./errors";

type Organization = typeof organizations.$inferSelect;

let cachedOrg: { data: Organization; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Get the singleton organization for this Fyren instance.
 * Each instance manages exactly one organization.
 * Results are cached in-memory for 30 seconds.
 *
 * Note: Cache is per-process. In multi-worker deployments, other workers
 * may serve stale data for up to CACHE_TTL_MS after an org update.
 * Call clearOrganizationCache() after mutations in the current process.
 */
export async function getOrganization() {
  if (cachedOrg && Date.now() < cachedOrg.expiresAt) {
    return cachedOrg.data;
  }

  const [org] = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.createdAt))
    .limit(1);

  if (!org) {
    throw new NotFoundError("No organization configured");
  }

  cachedOrg = { data: org, expiresAt: Date.now() + CACHE_TTL_MS };
  return org;
}

export function clearOrganizationCache() {
  cachedOrg = null;
}
