export interface WebhookPayload {
  event: string;
  timestamp: string;
  organization: {
    name: string;
    slug: string;
  };
  data: Record<string, unknown>;
}

export interface FormattedWebhook {
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}
