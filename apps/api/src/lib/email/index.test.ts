import { describe, test, expect, beforeEach } from "bun:test";
import { setupTestHooks, createTestOrganization } from "../../test";
import { getEmailProviderForOrg, clearAllProviderCaches } from "./index";

describe("getEmailProviderForOrg", () => {
  setupTestHooks();

  beforeEach(() => {
    clearAllProviderCaches();
  });

  test("formats from address with organization name", async () => {
    const org = await createTestOrganization({ name: "Acme Corp" });

    const provider = await getEmailProviderForOrg(org.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).fromAddress).toBe("Acme Corp <noreply@fyren.dev>");
  });

  test("formats from address with custom email", async () => {
    const org = await createTestOrganization({
      name: "My Status",
      emailFromAddress: "status@example.com",
    });

    const provider = await getEmailProviderForOrg(org.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((provider as any).fromAddress).toBe("My Status <status@example.com>");
  });
});
