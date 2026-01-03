import type { EmailProvider, EmailMessage, EmailResult } from "../types";

// For development - just logs emails to console
export class ConsoleProvider implements EmailProvider {
  private fromAddress: string;

  constructor(fromAddress?: string) {
    this.fromAddress = fromAddress || "noreply@fyren.dev";
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    console.log("========== EMAIL ==========");
    console.log(`From: ${message.from || this.fromAddress}`);
    console.log(`To: ${message.to}`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Body: ${message.text || message.html.substring(0, 500)}...`);
    console.log("===========================");

    return { success: true, messageId: `console-${Date.now()}` };
  }
}
