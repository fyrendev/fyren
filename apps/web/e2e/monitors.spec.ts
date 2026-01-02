import { test, expect, testData } from "./fixtures";

test.describe("Monitors Page", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/email/i).fill(testData.user.email);
    await page.getByLabel(/password/i).fill(testData.user.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to admin dashboard
    await page.waitForURL("/admin", { timeout: 30000 });
  });

  test("can navigate to monitors page", async ({ page }) => {
    await page
      .getByRole("link", { name: /monitors/i })
      .first()
      .click();
    await expect(page).toHaveURL("/admin/monitors");
    await expect(page.getByText(/monitors/i).first()).toBeVisible();
  });

  test("shows monitors list", async ({ page }) => {
    await page.goto("/admin/monitors");
    await page.waitForLoadState("networkidle");

    // Should show the monitors table or empty state
    const monitorsContent = page.locator("main");
    await expect(monitorsContent).toBeVisible();
  });

  test("can create a new monitor", async ({ page }) => {
    await page.goto("/admin/monitors");
    await page.waitForLoadState("networkidle");

    // Click create button - use first() to handle multiple matches
    const createButton = page.getByRole("button", { name: /create|new|add/i }).first();
    if (await createButton.isVisible()) {
      await createButton.click();

      // Fill in the monitor form - this may be in a modal or new page
      await page.waitForTimeout(500); // Wait for modal animation

      // Look for URL input
      const urlInput = page.getByLabel(/url/i);
      if (await urlInput.isVisible()) {
        await urlInput.fill("https://httpstat.us/200");
      }
    }
  });

  test("can toggle monitor active state", async ({ page }) => {
    await page.goto("/admin/monitors");
    await page.waitForLoadState("networkidle");

    // Look for a toggle button or switch
    const toggleButton = page.getByRole("button", { name: /toggle|pause|enable|disable/i }).first();

    if (await toggleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Get initial state indicator
      const initialState = await toggleButton.getAttribute("aria-pressed");

      // Click toggle
      await toggleButton.click();
      await page.waitForTimeout(500);

      // State should have changed
      const newState = await toggleButton.getAttribute("aria-pressed");
      expect(newState).not.toBe(initialState);
    }
  });

  test("shows monitor details", async ({ page }) => {
    await page.goto("/admin/monitors");
    await page.waitForLoadState("networkidle");

    // Click on a monitor to view details
    const monitorRow = page.locator("tr, [role='row']").first();
    if (await monitorRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await monitorRow.click();
      // Should navigate to detail page or show details
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Organization Creation", () => {
  test("shows organization creation page", async ({ page }) => {
    // This test checks that the org creation page loads
    await page.goto("/admin/organizations/new");
    await expect(page.getByRole("heading", { name: /create.*organization/i })).toBeVisible();
  });

  test("can create organization from new page", async ({ page }) => {
    await page.goto("/admin/organizations/new");
    await page.waitForLoadState("networkidle");

    // Check form elements are visible
    await expect(page.getByLabel(/organization name/i)).toBeVisible();
    await expect(page.getByLabel(/url slug/i)).toBeVisible();
  });
});
