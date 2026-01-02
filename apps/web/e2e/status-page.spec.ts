import { test, expect, testData } from "./fixtures";

test.describe("Public Status Page", () => {
  test("displays organization status page", async ({ page }) => {
    await page.goto(`/${testData.organization.slug}`);

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Should show organization name in the header
    await expect(page.locator("h1, h2, header")).toContainText([
      testData.organization.name,
    ]);
  });

  test("shows components section", async ({ page }) => {
    await page.goto(`/${testData.organization.slug}`);
    await page.waitForLoadState("networkidle");

    // Should show components heading
    const componentsHeading = page.getByRole("heading", { name: /components/i });
    await expect(componentsHeading).toBeVisible({ timeout: 10000 });
  });

  test("returns 404 for non-existent organization", async ({ page }) => {
    const response = await page.goto("/non-existent-org-slug-12345");

    // Should return 404 or show not found message
    const notFoundText = page.getByText(/not found/i);
    const is404 = response?.status() === 404;
    const hasNotFoundText = await notFoundText.isVisible().catch(() => false);

    expect(is404 || hasNotFoundText).toBe(true);
  });
});
