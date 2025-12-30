import type { EmailProvider, EmailProviderType } from "./types";
import { SESProvider } from "./providers/ses";
import { SendGridProvider } from "./providers/sendgrid";
import { SMTPProvider } from "./providers/smtp";
import { ConsoleProvider } from "./providers/console";

let emailProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (emailProvider) return emailProvider;

  const providerType = (process.env.EMAIL_PROVIDER ||
    "console") as EmailProviderType;

  switch (providerType) {
    case "ses":
      emailProvider = new SESProvider();
      break;
    case "sendgrid":
      emailProvider = new SendGridProvider();
      break;
    case "smtp":
      emailProvider = new SMTPProvider();
      break;
    case "console":
    default:
      emailProvider = new ConsoleProvider();
  }

  return emailProvider;
}

export * from "./types";
