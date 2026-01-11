import { test, expect, testData } from "./fixtures";

test.describe("Public Status Page", () => {
  test("displays organization status page", async ({ page }) => {
    // Single-tenant: status page is at root
    await page.goto("/");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Should show organization name in the header
    await expect(page.locator("h1, h2, header")).toContainText([testData.organization.name]);
  });

  test("shows components section", async ({ page }) => {
    // Single-tenant: status page is at root
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should show components heading
    const componentsHeading = page.getByRole("heading", { name: /components/i });
    await expect(componentsHeading).toBeVisible({ timeout: 10000 });
  });

  test("shows incident history page", async ({ page }) => {
    // Single-tenant: incidents page is at /incidents
    await page.goto("/incidents");
    await page.waitForLoadState("networkidle");

    // Should show incident history heading
    const heading = page.getByRole("heading", { name: /incident history/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });
});
