import type { EmailProvider, EmailMessage, EmailResult } from "../types";

export interface SendGridConfig {
  apiKey: string;
}

export class SendGridProvider implements EmailProvider {
  private apiKey: string;
  readonly fromAddress: string;

  constructor(config: SendGridConfig, fromAddress: string) {
    this.apiKey = config.apiKey;
    this.fromAddress = fromAddress;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: message.from || this.fromAddress },
          subject: message.subject,
          content: [
            { type: "text/html", value: message.html },
            ...(message.text ? [{ type: "text/plain", value: message.text }] : []),
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error };
      }

      return {
        success: true,
        messageId: response.headers.get("x-message-id") || undefined,
      };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  }
}
