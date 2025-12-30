import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { EmailProvider, EmailMessage, EmailResult } from "../types";

export class SESProvider implements EmailProvider {
  private client: SESClient;
  private fromAddress: string;

  constructor() {
    this.client = new SESClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.fromAddress = process.env.EMAIL_FROM || "noreply@fyren.dev";
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const command = new SendEmailCommand({
        Source: message.from || this.fromAddress,
        Destination: {
          ToAddresses: [message.to],
        },
        Message: {
          Subject: { Data: message.subject },
          Body: {
            Html: { Data: message.html },
            ...(message.text && { Text: { Data: message.text } }),
          },
        },
        ...(message.replyTo && { ReplyToAddresses: [message.replyTo] }),
      });

      const result = await this.client.send(command);
      return { success: true, messageId: result.MessageId };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  }
}
