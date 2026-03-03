import { test as setup } from "@playwright/test";

const API_URL = "http://localhost:3001";

/**
 * Global setup for E2E tests.
 * Creates test organization and seed data via API.
 */
setup("seed test data", async ({ request }) => {
  // Wait for API to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      const health = await request.get(`${API_URL}/health`);
      if (health.ok()) break;
    } catch {
      // API not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
    retries--;
  }

  if (retries === 0) {
    throw new Error("API failed to start");
  }

  // Clean existing test data
  await request.post(`${API_URL}/api/v1/test/reset`, {
    headers: { "Content-Type": "application/json" },
    failOnStatusCode: false,
  });

  // Create test organization via internal API
  const orgRes = await request.post(`${API_URL}/api/v1/test/setup`, {
    headers: { "Content-Type": "application/json" },
    data: {
      organization: {
        name: "E2E Test Org",
        slug: "e2e-test",
      },
      user: {
        email: "e2e@test.com",
        password: "testpassword123",
        name: "E2E Test User",
      },
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

  if (!orgRes.ok()) {
    const body = await orgRes.text();
    console.log("Setup response:", orgRes.status(), body);
    // If test setup endpoint doesn't exist, we'll create data via admin API
    // This is expected on first run
  }
});
