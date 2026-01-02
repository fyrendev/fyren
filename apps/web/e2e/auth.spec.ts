import { test, expect, testData } from "./fixtures";

test.describe("Admin Authentication", () => {
  test("displays login page", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    // Should show login form elements
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows register link", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    // Should show link to register
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("login form has required fields", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    // Should have email and password inputs
    await expect(page.getByLabel(/email/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/password/i)).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to register page", async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    // Click sign up link
    await page.getByRole("link", { name: /sign up/i }).click();

    // Should navigate to register
    await expect(page).toHaveURL("/admin/register");
  });

  test("redirects unauthenticated users from admin dashboard", async ({
    page,
  }) => {
    await page.goto("/admin");

    // Should redirect to login
    await page.waitForURL(/\/admin\/(login)?/, { timeout: 10000 });
  });
});
