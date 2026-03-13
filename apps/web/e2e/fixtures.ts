import { test as base, expect as baseExpect } from "@playwright/test";

const API_URL = "http://localhost:3001";

interface TestUser {
  email: string;
  password: string;
  name: string;
}

interface TestOrganization {
  name: string;
}

interface TestData {
  user: TestUser;
  organization: TestOrganization;
}

/**
 * Default test user and organization.
 */
export const testData: TestData = {
  user: {
    email: "e2e@test.com",
    password: "testpassword123",
    name: "E2E Test User",
  },
  organization: {
    name: "E2E Test Org",
  },
};

/**
 * Extended test fixture with authentication helpers.
 */
export const test = base.extend<{
  authenticatedPage: typeof base;
}>({
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login page
    await page.goto("/admin/login");

    // Fill in login form
    await page.getByLabel("Email").fill(testData.user.email);
    await page.getByLabel("Password").fill(testData.user.password);

    // Click sign in button
    await page.getByRole("button", { name: "Sign In" }).click();

    // Wait for redirect to admin dashboard
    await page.waitForURL("/admin", { timeout: 10000 });

    await use(base);
  },
});

export const expect = baseExpect;

/**
 * Helper to setup test data via API.
 */
export async function setupTestData(request: typeof test.prototype.request) {
  // Reset database
  await request.post(`${API_URL}/api/v1/test/reset`);

  // Setup test data
  const response = await request.post(`${API_URL}/api/v1/test/setup`, {
    data: {
      organization: testData.organization,
      user: testData.user,
      components: [
        { name: "API Gateway", status: "operational" },
        { name: "Database", status: "operational" },
        { name: "Web Application", status: "degraded" },
      ],
      incidents: [
        {
          title: "API Latency Issues",
          status: "investigating",
          severity: "minor",
          message: "We are investigating elevated API response times.",
        },
      ],
    },
  });

  return response;
}
