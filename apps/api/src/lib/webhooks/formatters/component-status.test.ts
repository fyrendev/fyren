import { describe, it, expect } from "bun:test";
import { formatSlackWebhook } from "./slack";
import { formatDiscordWebhook } from "./discord";
import { formatTeamsWebhook } from "./teams";
import { formatGenericWebhook } from "./generic";
import type { WebhookPayload } from "../types";

function makePayload(overrides: Partial<WebhookPayload["data"]> = {}): WebhookPayload {
  return {
    event: "component.status_changed",
    timestamp: new Date().toISOString(),
    organization: { name: "Acme Corp" },
    data: {
      componentName: "API Server",
      previousStatus: "operational",
      newStatus: "major_outage",
      monitorId: "mon-123",
      ...overrides,
    },
  };
}

describe("component.status_changed webhook formatting", () => {
  describe("slack", () => {
    it("should format a downtime notification", () => {
      const result = formatSlackWebhook(makePayload());
      const attachment = (result.body as { attachments: Array<Record<string, unknown>> })
        .attachments[0]!;

      expect(attachment.title).toBe("Component Status Change: API Server");
      expect(attachment.text).toContain("API Server");
      expect(attachment.text).toContain("operational");
      expect(attachment.text).toContain("major_outage");
      expect(attachment.color).toBe("#dc2626"); // red for major_outage
    });

    it("should format a recovery notification with green color", () => {
      const result = formatSlackWebhook(
        makePayload({ previousStatus: "major_outage", newStatus: "operational" })
      );
      const attachment = (result.body as { attachments: Array<Record<string, unknown>> })
        .attachments[0]!;

      expect(attachment.color).toBe("#16a34a"); // green for recovery
    });

    it("should use orange for degraded status", () => {
      const result = formatSlackWebhook(makePayload({ newStatus: "degraded" }));
      const attachment = (result.body as { attachments: Array<Record<string, unknown>> })
        .attachments[0]!;

      expect(attachment.color).toBe("#ea580c"); // orange for degraded
    });
  });

  describe("discord", () => {
    it("should format a downtime notification", () => {
      const result = formatDiscordWebhook(makePayload());
      const embed = (result.body as { embeds: Array<Record<string, unknown>> }).embeds[0]!;

      expect(embed.title).toBe("Component Status Change: API Server");
      expect(embed.description).toContain("API Server");
      expect(embed.color).toBe(0xdc2626);
    });

    it("should format a recovery notification", () => {
      const result = formatDiscordWebhook(
        makePayload({ previousStatus: "major_outage", newStatus: "operational" })
      );
      const embed = (result.body as { embeds: Array<Record<string, unknown>> }).embeds[0]!;

      expect(embed.color).toBe(0x16a34a);
    });
  });

  describe("teams", () => {
    it("should format a downtime notification", () => {
      const result = formatTeamsWebhook(makePayload());
      const sections = result.body.sections as Array<Record<string, unknown>>;

      expect(sections[0]!.activityTitle).toBe("Component Status Change: API Server");
      expect(sections[0]!.text).toContain("API Server");
      expect(result.body.themeColor).toBe("dc2626");
    });

    it("should format a recovery notification", () => {
      const result = formatTeamsWebhook(
        makePayload({ previousStatus: "major_outage", newStatus: "operational" })
      );

      expect(result.body.themeColor).toBe("16a34a");
    });
  });

  describe("generic", () => {
    it("should pass through the component status data", () => {
      const payload = makePayload();
      const result = formatGenericWebhook(payload);

      expect(result.body.event).toBe("component.status_changed");
      expect((result.body.data as Record<string, unknown>).componentName).toBe("API Server");
      expect((result.body.data as Record<string, unknown>).newStatus).toBe("major_outage");
    });
  });
});
