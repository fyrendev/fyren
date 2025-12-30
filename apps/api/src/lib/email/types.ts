export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}

export type EmailProviderType = "ses" | "sendgrid" | "smtp" | "console";
