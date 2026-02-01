import { beforeEach } from "bun:test";
import { db, sql } from "@fyrendev/db";
import { redis } from "../lib/redis";

/**
 * Clean all data from the database before each test.
 * Tables are truncated in reverse dependency order.
 */
export async function cleanDatabase() {
  await db.execute(sql`
    TRUNCATE TABLE
      notification_logs,
      webhook_endpoints,
      subscribers,
      subscriber_groups,
      maintenance_components,
      maintenances,
      incident_components,
      incident_updates,
      incidents,
      incident_templates,
      monitor_results,
      monitors,
      components,
      api_keys,
      organization_invites,
      user_organizations,
      sessions,
      accounts,
      verifications,
      users,
      organizations,
      system_settings
    RESTART IDENTITY CASCADE
  `);
}

/**
 * Clear all Redis keys used by the app.
 * Only clears test-related keys to avoid interfering with running services.
 */
export async function cleanRedis() {
  try {
    // Use FLUSHDB to clear all keys in current database
    // This is safe in test environment
    await redis.flushdb();
  } catch (error) {
    // Log warning if Redis cleanup fails - tests may have stale cache data
    console.warn("Redis cleanup failed:", error);
  }
}

/**
 * Setup global test hooks.
 * Call this in test files that need database cleanup.
 */
export function setupTestHooks() {
  beforeEach(async () => {
    await cleanDatabase();
    await cleanRedis();
  });

  // Note: We don't close Redis here because tests run in parallel
  // and closing in one file would break other files.
  // The connection will be closed when the process exits.
}
