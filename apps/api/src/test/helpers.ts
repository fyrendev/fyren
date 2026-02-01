import {
  db,
  organizations,
  components,
  apiKeys,
  users,
  userOrganizations,
  monitors,
  incidents,
  incidentUpdates,
  incidentComponents,
  maintenances,
  maintenanceComponents,
  subscribers,
  subscriberGroups,
  webhookEndpoints,
  systemSettings,
} from "@fyrendev/db";
import { generateApiKey } from "../lib/api-key";

/**
 * Generate a random string for unique test data.
 */
function randomString(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join(
    ""
  );
}

/**
 * Create a test organization.
 */
export async function createTestOrganization(
  overrides: Partial<typeof organizations.$inferInsert> = {}
) {
  const slug = overrides.slug || `test-org-${randomString()}`;

  const [org] = await db
    .insert(organizations)
    .values({
      name: overrides.name || "Test Organization",
      slug,
      timezone: overrides.timezone || "UTC",
      ...overrides,
    })
    .returning();

  if (!org) throw new Error("Failed to create test organization");
  return org;
}

/**
 * Create a test API key and return both the key record and the raw key.
 */
export async function createTestApiKey(
  organizationId: string,
  overrides: Partial<typeof apiKeys.$inferInsert> = {}
) {
  const keyData = await generateApiKey();

  const [apiKey] = await db
    .insert(apiKeys)
    .values({
      organizationId,
      name: overrides.name || "Test API Key",
      keyHash: keyData.keyHash,
      keyPrefix: keyData.keyPrefix,
      ...overrides,
    })
    .returning();

  if (!apiKey) throw new Error("Failed to create test API key");
  return { apiKey, rawKey: keyData.key };
}

/**
 * Create a test user.
 */
export async function createTestUser(overrides: Partial<typeof users.$inferInsert> = {}) {
  const [user] = await db
    .insert(users)
    .values({
      id: overrides.id || crypto.randomUUID(),
      email: overrides.email || `test-${randomString()}@example.com`,
      name: overrides.name || "Test User",
      emailVerified: overrides.emailVerified ?? true,
      ...overrides,
    })
    .returning();

  if (!user) throw new Error("Failed to create test user");
  return user;
}

/**
 * Create a user-organization membership.
 */
export async function createTestMembership(
  userId: string,
  organizationId: string,
  role: "owner" | "admin" | "member" = "owner"
) {
  const [membership] = await db
    .insert(userOrganizations)
    .values({
      userId,
      organizationId,
      role,
    })
    .returning();

  if (!membership) throw new Error("Failed to create test membership");
  return membership;
}

/**
 * Create a test component.
 */
export async function createTestComponent(
  organizationId: string,
  overrides: Partial<typeof components.$inferInsert> = {}
) {
  const [component] = await db
    .insert(components)
    .values({
      organizationId,
      name: overrides.name || "Test Component",
      description: overrides.description || "A test component",
      status: overrides.status || "operational",
      displayOrder: overrides.displayOrder ?? 0,
      isPublic: overrides.isPublic ?? true,
      ...overrides,
    })
    .returning();

  if (!component) throw new Error("Failed to create test component");
  return component;
}

/**
 * Create a test monitor.
 */
export async function createTestMonitor(
  componentId: string,
  overrides: Partial<typeof monitors.$inferInsert> = {}
) {
  const [monitor] = await db
    .insert(monitors)
    .values({
      componentId,
      type: overrides.type || "http",
      url: overrides.url || "https://example.com",
      intervalSeconds: overrides.intervalSeconds ?? 60,
      timeoutMs: overrides.timeoutMs ?? 5000,
      expectedStatusCode: overrides.expectedStatusCode ?? 200,
      failureThreshold: overrides.failureThreshold ?? 3,
      isActive: overrides.isActive ?? true,
      ...overrides,
    })
    .returning();

  if (!monitor) throw new Error("Failed to create test monitor");
  return monitor;
}

/**
 * Create a test incident.
 */
export async function createTestIncident(
  organizationId: string,
  overrides: Partial<typeof incidents.$inferInsert> = {}
) {
  const [incident] = await db
    .insert(incidents)
    .values({
      organizationId,
      title: overrides.title || "Test Incident",
      status: overrides.status || "investigating",
      severity: overrides.severity || "minor",
      startedAt: overrides.startedAt || new Date(),
      ...overrides,
    })
    .returning();

  if (!incident) throw new Error("Failed to create test incident");
  return incident;
}

/**
 * Create a test incident update.
 */
export async function createTestIncidentUpdate(
  incidentId: string,
  overrides: Partial<typeof incidentUpdates.$inferInsert> = {}
) {
  const [update] = await db
    .insert(incidentUpdates)
    .values({
      incidentId,
      status: overrides.status || "investigating",
      message: overrides.message || "Test update message",
      ...overrides,
    })
    .returning();

  if (!update) throw new Error("Failed to create test incident update");
  return update;
}

/**
 * Link an incident to a component.
 */
export async function createTestIncidentComponent(incidentId: string, componentId: string) {
  const [link] = await db
    .insert(incidentComponents)
    .values({
      incidentId,
      componentId,
    })
    .returning();

  if (!link) throw new Error("Failed to create test incident component link");
  return link;
}

/**
 * Create a test maintenance window.
 */
export async function createTestMaintenance(
  organizationId: string,
  overrides: Partial<typeof maintenances.$inferInsert> = {}
) {
  const now = new Date();
  const scheduledStartAt = overrides.scheduledStartAt || new Date(now.getTime() + 86400000); // Tomorrow
  const scheduledEndAt = overrides.scheduledEndAt || new Date(scheduledStartAt.getTime() + 3600000); // 1 hour later

  const [maint] = await db
    .insert(maintenances)
    .values({
      organizationId,
      title: overrides.title || "Test Maintenance",
      description: overrides.description || "Test maintenance description",
      status: overrides.status || "scheduled",
      scheduledStartAt,
      scheduledEndAt,
      ...overrides,
    })
    .returning();

  if (!maint) throw new Error("Failed to create test maintenance");
  return maint;
}

/**
 * Link a maintenance window to a component.
 */
export async function createTestMaintenanceComponent(maintenanceId: string, componentId: string) {
  const [link] = await db
    .insert(maintenanceComponents)
    .values({
      maintenanceId,
      componentId,
    })
    .returning();

  if (!link) throw new Error("Failed to create test maintenance component link");
  return link;
}

/**
 * Create a test subscriber group.
 */
export async function createTestSubscriberGroup(
  organizationId: string,
  overrides: Partial<typeof subscriberGroups.$inferInsert> = {}
) {
  const [group] = await db
    .insert(subscriberGroups)
    .values({
      organizationId,
      name: overrides.name || `Test Group ${randomString()}`,
      description: overrides.description || "A test subscriber group",
      componentIds: overrides.componentIds ?? null,
      ...overrides,
    })
    .returning();

  if (!group) throw new Error("Failed to create test subscriber group");
  return group;
}

/**
 * Create a test subscriber.
 */
export async function createTestSubscriber(
  organizationId: string,
  overrides: Partial<typeof subscribers.$inferInsert> = {}
) {
  const [subscriber] = await db
    .insert(subscribers)
    .values({
      organizationId,
      email: overrides.email || `subscriber-${randomString()}@example.com`,
      verified: overrides.verified ?? true,
      verificationToken: overrides.verificationToken || randomString(32),
      unsubscribeToken: overrides.unsubscribeToken || randomString(32),
      ...overrides,
    })
    .returning();

  if (!subscriber) throw new Error("Failed to create test subscriber");
  return subscriber;
}

/**
 * Create a test webhook endpoint.
 */
export async function createTestWebhook(
  organizationId: string,
  overrides: Partial<typeof webhookEndpoints.$inferInsert> = {}
) {
  const [webhook] = await db
    .insert(webhookEndpoints)
    .values({
      organizationId,
      name: overrides.name || "Test Webhook",
      url: overrides.url || "https://example.com/webhook",
      type: overrides.type || "generic",
      enabled: overrides.enabled ?? true,
      ...overrides,
    })
    .returning();

  if (!webhook) throw new Error("Failed to create test webhook");
  return webhook;
}

/**
 * Helper to create Authorization header with API key.
 */
export function authHeader(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Helper to create headers with JSON content type and API key auth.
 */
export function jsonAuthHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Create or get system settings.
 */
export async function createTestSystemSettings(
  overrides: Partial<typeof systemSettings.$inferInsert> = {}
) {
  const [settings] = await db
    .insert(systemSettings)
    .values({
      logProvider: overrides.logProvider || "console",
      logLevel: overrides.logLevel || "info",
      logServiceName: overrides.logServiceName || "fyren-api",
      ...overrides,
    })
    .returning();

  if (!settings) throw new Error("Failed to create test system settings");
  return settings;
}
