import { createTransport, type Transporter } from "nodemailer";
import type { EmailProvider, EmailMessage, EmailResult } from "../types";

export class SMTPProvider implements EmailProvider {
  private transporter: Transporter;
  private fromAddress: string;

  constructor() {
    this.transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587", 10),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    this.fromAddress = process.env.EMAIL_FROM || "noreply@fyren.dev";
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
