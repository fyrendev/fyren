import type { EmailProvider, EmailProviderType } from "./types";
import { SESProvider, type SESConfig } from "./providers/ses";
import { SendGridProvider, type SendGridConfig } from "./providers/sendgrid";
import { SMTPProvider, type SMTPConfig } from "./providers/smtp";
import { ConsoleProvider } from "./providers/console";
import { getOrganization } from "../organization";
import { decryptJson, isEncryptionAvailable } from "../encryption";
import { logger } from "../logging";

// Cached email provider (singleton — one org per instance)
let providerCache: { provider: EmailProvider; createdAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the email provider configured for this Fyren instance.
 * Reads the organization's email configuration from the database,
 * decrypts credentials, and creates the appropriate provider.
 */
export async function getEmailProvider(): Promise<EmailProvider> {
  // Check cache first
  if (providerCache && Date.now() - providerCache.createdAt < CACHE_TTL_MS) {
    return providerCache.provider;
  }

  // Fetch organization from database
  let org;
  try {
    org = await getOrganization();
  } catch {
    logger.warn("No organization configured, using console email provider");
    return new ConsoleProvider();
  }

  const providerType = org.emailProvider as EmailProviderType;
  const fromAddress = `${org.name} <${org.emailFromAddress || "noreply@fyren.dev"}>`;

  let provider: EmailProvider;

  switch (providerType) {
    case "smtp": {
      if (!org.emailConfig) {
        logger.warn("SMTP config missing, using console provider");
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      if (!isEncryptionAvailable()) {
        logger.error("Cannot decrypt SMTP config, ENCRYPTION_KEY not set");
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      const config = decryptJson<SMTPConfig>(org.emailConfig);
      provider = new SMTPProvider(config, fromAddress);
      break;
    }
    case "sendgrid": {
      if (!org.emailConfig) {
        logger.warn("SendGrid config missing, using console provider");
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      if (!isEncryptionAvailable()) {
        logger.error("Cannot decrypt SendGrid config, ENCRYPTION_KEY not set");
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      const config = decryptJson<SendGridConfig>(org.emailConfig);
      provider = new SendGridProvider(config, fromAddress);
      break;
    }
    case "ses": {
      if (!org.emailConfig) {
        logger.warn("SES config missing, using console provider");
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      if (!isEncryptionAvailable()) {
        logger.error("Cannot decrypt SES config, ENCRYPTION_KEY not set");
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      const config = decryptJson<SESConfig>(org.emailConfig);
      provider = new SESProvider(config, fromAddress);
      break;
    }
    case "console":
    default:
      provider = new ConsoleProvider(fromAddress);
  }

  // Cache the provider
  providerCache = { provider, createdAt: Date.now() };

  return provider;
}

/**
 * Clear the cached provider.
 * Call this when organization email settings are updated.
 */
export function clearProviderCache(): void {
  providerCache = null;
}

export * from "./types";
export type { SMTPConfig } from "./providers/smtp";
export type { SendGridConfig } from "./providers/sendgrid";
export type { SESConfig } from "./providers/ses";
