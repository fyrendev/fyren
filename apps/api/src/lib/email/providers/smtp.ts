import { createTransport, type Transporter } from "nodemailer";
import type { EmailProvider, EmailMessage, EmailResult } from "../types";

export interface SMTPConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  secure?: boolean;
}

export class SMTPProvider implements EmailProvider {
  private transporter: Transporter;
  private fromAddress: string;

  constructor(config: SMTPConfig, fromAddress: string) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? true,
      auth:
        config.user && config.password
          ? {
              user: config.user,
              pass: config.password,
            }
          : undefined,
    });
    this.fromAddress = fromAddress;
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const result = await this.transporter.sendMail({
        from: message.from || this.fromAddress,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      });

      return { success: true, messageId: result.messageId };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  }
}
