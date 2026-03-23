import {
  db,
  eq,
  organizations,
  components,
  apiKeys,
  users,
  monitors,
  monitorResults,
  incidents,
  incidentUpdates,
  incidentComponents,
  maintenances,
  maintenanceComponents,
  subscribers,
  subscriberGroups,
  webhookEndpoints,
  systemSettings,
  incidentTemplates,
  organizationInvites,
  sessions,
} from "@fyrendev/db";
import type { OrgRole } from "@fyrendev/db";
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
  const [org] = await db
    .insert(organizations)
    .values({
      name: overrides.name || "Test Organization",
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
export async function createTestApiKey(overrides: Partial<typeof apiKeys.$inferInsert> = {}) {
  const keyData = await generateApiKey();

  const [apiKey] = await db
    .insert(apiKeys)
    .values({
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
export async function createTestUser(
  overrides: Partial<typeof users.$inferInsert> = {},
  role?: OrgRole
) {
  const [user] = await db
    .insert(users)
    .values({
      id: overrides.id || crypto.randomUUID(),
      email: overrides.email || `test-${randomString()}@example.com`,
      name: overrides.name || "Test User",
      emailVerified: overrides.emailVerified ?? true,
      role: role || overrides.role || null,
      ...overrides,
    })
    .returning();

  if (!user) throw new Error("Failed to create test user");
  return user;
}

/**
 * Create a test component.
 */
export async function createTestComponent(overrides: Partial<typeof components.$inferInsert> = {}) {
  const [component] = await db
    .insert(components)
    .values({
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
 * Create a test monitor result.
 */
export async function createTestMonitorResult(
  monitorId: string,
  overrides: Partial<typeof monitorResults.$inferInsert> = {}
) {
  const [result] = await db
    .insert(monitorResults)
    .values({
      monitorId,
      status: overrides.status || "up",
      responseTimeMs: overrides.responseTimeMs ?? 100,
      statusCode: overrides.statusCode ?? 200,
      checkedAt: overrides.checkedAt || new Date(),
      ...overrides,
    })
    .returning();

  if (!result) throw new Error("Failed to create test monitor result");
  return result;
}

/**
 * Create a test incident.
 */
export async function createTestIncident(overrides: Partial<typeof incidents.$inferInsert> = {}) {
  const [incident] = await db
    .insert(incidents)
    .values({
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
  overrides: Partial<typeof maintenances.$inferInsert> = {}
) {
  const now = new Date();
  const scheduledStartAt = overrides.scheduledStartAt || new Date(now.getTime() + 86400000); // Tomorrow
  const scheduledEndAt = overrides.scheduledEndAt || new Date(scheduledStartAt.getTime() + 3600000); // 1 hour later

  const [maint] = await db
    .insert(maintenances)
    .values({
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
  overrides: Partial<typeof subscriberGroups.$inferInsert> = {}
) {
  const [group] = await db
    .insert(subscriberGroups)
    .values({
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
  overrides: Partial<typeof subscribers.$inferInsert> = {}
) {
  const [subscriber] = await db
    .insert(subscribers)
    .values({
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
  overrides: Partial<typeof webhookEndpoints.$inferInsert> = {}
) {
  const [webhook] = await db
    .insert(webhookEndpoints)
    .values({
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

/**
 * Create a test incident template.
 */
export async function createTestIncidentTemplate(
  overrides: Partial<typeof incidentTemplates.$inferInsert> = {}
) {
  const [template] = await db
    .insert(incidentTemplates)
    .values({
      name: overrides.name || `Test Template ${randomString()}`,
      title: overrides.title || "Test Incident Title",
      severity: overrides.severity || "major",
      initialMessage: overrides.initialMessage || "Initial incident message",
      defaultComponentIds: overrides.defaultComponentIds ?? [],
      ...overrides,
    })
    .returning();

  if (!template) throw new Error("Failed to create test incident template");
  return template;
}

/**
 * Create a test organization invite.
 */
export async function createTestInvite(
  invitedBy: string,
  overrides: Partial<typeof organizationInvites.$inferInsert> = {}
) {
  const token = overrides.token || randomString(32);
  const expiresAt = overrides.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [invite] = await db
    .insert(organizationInvites)
    .values({
      email: overrides.email || `invite-${randomString()}@example.com`,
      role: overrides.role || "member",
      token,
      invitedBy,
      expiresAt,
      ...overrides,
    })
    .returning();

  if (!invite) throw new Error("Failed to create test invite");
  return invite;
}

/**
 * Sign up a new user and create a session via BetterAuth.
 * Returns the session token extracted from the response cookie.
 *
 * @param email - Email for the new user
 * @param password - Password for the new user (defaults to a random strong password)
 * @param name - Name for the user (defaults to "Test User")
 * @param role - Role to assign to the user after sign-up
 */
export async function signUpTestUser(
  email?: string,
  password?: string,
  name?: string,
  role?: OrgRole
): Promise<{ user: typeof users.$inferSelect; token: string }> {
  const testEmail = email || `test-${randomString()}@example.com`;
  const testPassword = password || `TestPass123!${randomString(8)}`;
  const testName = name || "Test User";

  // Create the test app for making requests
  const { createTestApp } = await import("./app");
  const app = createTestApp();

  // Create a pending invite so the signup hook allows this email,
  // then mark it as accepted after signup so it doesn't pollute test data
  const signupInviteToken = randomString(32);
  await db.insert(organizationInvites).values({
    email: testEmail,
    role: "member",
    token: signupInviteToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  // Sign up creates an account entry with a password and returns a session
  const signUpRes = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword,
      name: testName,
    }),
  });

  if (signUpRes.status !== 200) {
    const body = await signUpRes.text();
    throw new Error(`Sign-up failed: ${signUpRes.status} - ${body}`);
  }

  // Extract session token from Set-Cookie header
  const setCookie = signUpRes.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("No session cookie returned from sign-up");
  }

  // Parse the session token from the cookie
  const tokenMatch = setCookie.match(/better-auth\.session_token=([^;]+)/);
  if (!tokenMatch || !tokenMatch[1]) {
    throw new Error("Could not parse session token from cookie");
  }

  const token = decodeURIComponent(tokenMatch[1]);

  // Get the created user from DB
  const [user] = await db.select().from(users).where(eq(users.email, testEmail)).limit(1);

  if (!user) throw new Error("User not created during sign-up");

  // Mark the auto-created invite as accepted so it doesn't appear in pending lists
  await db
    .update(organizationInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(organizationInvites.token, signupInviteToken));

  // Set role if provided
  if (role) {
    await db.update(users).set({ role }).where(eq(users.id, user.id));
    user.role = role;
  }

  return { user, token };
}

/**
 * Create a test session for an existing user.
 * This signs up a NEW user via BetterAuth and returns the session.
 *
 * Note: For existing users created via createTestUser(), you should use
 * signUpTestUser() instead as BetterAuth requires the full auth flow.
 *
 * @deprecated Use signUpTestUser() for new tests that need session auth.
 * This function exists for backwards compatibility.
 */
export async function createTestSession(userId: string) {
  // Look up the user
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) throw new Error(`User not found: ${userId}`);

  const sessionId = crypto.randomUUID();
  const token = randomString(64);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const [session] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      userId,
      token,
      expiresAt,
    })
    .returning();

  if (!session) throw new Error("Failed to create test session");

  return { session, token };
}

/**
 * Helper to create session cookie header.
 */
export function sessionCookieHeader(sessionToken: string): Record<string, string> {
  return {
    Cookie: `better-auth.session_token=${sessionToken}`,
  };
}

/**
 * Helper to create headers with JSON content type and session cookie.
 */
export function jsonSessionHeaders(sessionToken: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Cookie: `better-auth.session_token=${sessionToken}`,
  };
}
