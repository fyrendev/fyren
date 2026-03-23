import { test, expect, testData } from "./fixtures";

test.describe("Toast Notifications and Confirm Dialog", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/login");
    await page.waitForLoadState("networkidle");

    await page.getByLabel(/email/i).fill(testData.user.email);
    await page.getByLabel(/password/i).fill(testData.user.password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL("/admin", { timeout: 30000 });
  });

  test("shows toast when saving settings", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.waitForLoadState("networkidle");

    // Click Save Changes
    await page.getByRole("button", { name: /save changes/i }).click();

    // A sonner toast should appear (success or error depending on API state)
    const toastElement = page.locator("[data-sonner-toast]");
    await expect(toastElement.first()).toBeVisible({ timeout: 5000 });
  });

  test("shows confirm dialog when deleting a component", async ({ page }) => {
    await page.goto("/admin/components");
    await page.waitForLoadState("networkidle");

    // Test data should include components — assert the precondition
    const deleteButton = page.locator('button[title="Delete component"]').first();
    await expect(deleteButton).toBeVisible({ timeout: 10000 });

    await deleteButton.click();

    // Confirm dialog should appear
    await expect(page.getByText("Delete Component")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /delete/i })).toBeVisible();

    // Cancel should close the dialog
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByText("Delete Component")).not.toBeVisible();
  });

  test("confirm dialog executes action and shows success toast", async ({ page }) => {
    await page.goto("/admin/components");
    await page.waitForLoadState("networkidle");

    // Test data should include components — assert the precondition
    const deleteButton = page.locator('button[title="Delete component"]').last();
    await expect(deleteButton).toBeVisible({ timeout: 10000 });

    await deleteButton.click();

    // Confirm dialog should appear
    await expect(page.getByText("Delete Component")).toBeVisible({ timeout: 5000 });

    // Click confirm — use last() to avoid matching the dialog's own delete button
    await page
      .getByRole("button", { name: /delete/i })
      .last()
      .click();

    // Success toast should appear
    await expect(page.getByText("Component deleted")).toBeVisible({ timeout: 5000 });
  });

  test("system page shows toast on save", async ({ page }) => {
    await page.goto("/admin/system");
    await page.waitForLoadState("networkidle");

    // Click Save Only button
    const saveButton = page.getByRole("button", { name: /save only/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    await saveButton.click();

    // Should show a toast (success or error depending on config)
    const toastElement = page.locator("[data-sonner-toast]");
    await expect(toastElement.first()).toBeVisible({ timeout: 5000 });
  });
});
