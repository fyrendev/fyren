import { logger } from "../../logging";
import type { EmailProvider, EmailMessage, EmailResult } from "../types";

// For development - just logs emails to console
export class ConsoleProvider implements EmailProvider {
  readonly fromAddress: string;

  constructor(fromAddress?: string) {
    this.fromAddress = fromAddress || "noreply@fyren.dev";
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    logger.info("Sending email", {
      from: message.from || this.fromAddress,
      to: message.to,
      subject: message.subject,
      text: message.text || message.html.substring(0, 500),
    });

    return { success: true, messageId: `console-${Date.now()}` };
  }
}
