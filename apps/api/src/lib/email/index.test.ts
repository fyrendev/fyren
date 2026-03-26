import { describe, test, expect } from "bun:test";
import { ConsoleProvider } from "./providers/console";

describe("Email providers", () => {
  test("ConsoleProvider uses default from address", () => {
    const provider = new ConsoleProvider();
    expect(provider.fromAddress).toBe("noreply@fyren.dev");
  });

  test("ConsoleProvider uses custom from address", () => {
    const provider = new ConsoleProvider("Acme Corp <noreply@acme.com>");
    expect(provider.fromAddress).toBe("Acme Corp <noreply@acme.com>");
  });
});
