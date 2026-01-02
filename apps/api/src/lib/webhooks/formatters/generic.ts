import { createHmac } from "crypto";
import type { WebhookPayload, FormattedWebhook } from "../types";

export function formatGenericWebhook(payload: WebhookPayload, secret?: string): FormattedWebhook {
  const body: Record<string, unknown> = {
    event: payload.event,
    timestamp: payload.timestamp,
    organization: payload.organization,
    data: payload.data,
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add signature if secret is provided
  if (secret) {
    const signature = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
    headers["X-Fyren-Signature"] = `sha256=${signature}`;
  }

  return { body, headers };
}
