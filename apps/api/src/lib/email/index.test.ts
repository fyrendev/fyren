import { describe, test, expect, beforeEach } from "bun:test";
import { setupTestHooks, createTestOrganization } from "../../test";
import { getEmailProvider, clearProviderCache } from "./index";
import { clearOrganizationCache } from "../organization";

describe("getEmailProvider", () => {
  setupTestHooks();

  beforeEach(() => {
    clearProviderCache();
    clearOrganizationCache();
  });

  test("formats from address with organization name", async () => {
    await createTestOrganization({ name: "Acme Corp" });

    const provider = await getEmailProvider();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).fromAddress).toBe("Acme Corp <noreply@fyren.dev>");
  });

  test("formats from address with custom email", async () => {
    await createTestOrganization({
      name: "My Status",
      emailFromAddress: "status@example.com",
    });

    const provider = await getEmailProvider();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).fromAddress).toBe("My Status <status@example.com>");
  });
});
