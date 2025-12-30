import type { WebhookType } from "@fyrendev/shared";
import type { WebhookPayload, FormattedWebhook } from "./types";
import { formatSlackWebhook } from "./formatters/slack";
import { formatDiscordWebhook } from "./formatters/discord";
import { formatTeamsWebhook } from "./formatters/teams";
import { formatGenericWebhook } from "./formatters/generic";

export function formatWebhook(
  type: WebhookType,
  payload: WebhookPayload,
  secret?: string
): FormattedWebhook {
  switch (type) {
    case "slack":
      return formatSlackWebhook(payload);
    case "discord":
      return formatDiscordWebhook(payload);
    case "teams":
      return formatTeamsWebhook(payload);
    case "generic":
    default:
      return formatGenericWebhook(payload, secret);
  }
}

export * from "./types";
