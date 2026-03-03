import { test, expect, testData } from "./fixtures";

test.describe("Admin Dashboard", () => {
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

  test("shows dashboard after login", async ({ page }) => {
    // Should show dashboard content
    await expect(page.getByText(/dashboard/i)).toBeVisible({ timeout: 10000 });
  });

  test("shows stats cards", async ({ page }) => {
    // Should show stat cards
    await expect(page.getByText(/components/i)).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to components page", async ({ page }) => {
    // Click components link in sidebar
    await page
      .getByRole("link", { name: /components/i })
      .first()
      .click();

    // Should navigate to components page
    await expect(page).toHaveURL("/admin/components");
  });

  test("can navigate to incidents page", async ({ page }) => {
    // Click incidents link in sidebar
    await page
      .getByRole("link", { name: /incidents/i })
      .first()
      .click();

    // Should navigate to incidents page
    await expect(page).toHaveURL("/admin/incidents");
  });
});
