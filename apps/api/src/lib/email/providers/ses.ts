import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import type { EmailProvider, EmailMessage, EmailResult } from "../types";

export interface SESConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export class SESProvider implements EmailProvider {
  private client: SESClient;

  constructor(
    config: SESConfig,
    readonly fromAddress: string
  ) {
    this.client = new SESClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
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
