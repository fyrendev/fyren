import type { EmailProvider, EmailProviderType } from "./types";
import { SESProvider, type SESConfig } from "./providers/ses";
import { SendGridProvider, type SendGridConfig } from "./providers/sendgrid";
import { SMTPProvider, type SMTPConfig } from "./providers/smtp";
import { ConsoleProvider } from "./providers/console";
import { db } from "../db";
import { organizations, eq } from "@fyrendev/db";
import { decryptJson, isEncryptionAvailable } from "../encryption";
import { logger } from "../logging";

// Cache of email providers by organization ID
const providerCache = new Map<string, { provider: EmailProvider; createdAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get an email provider configured for a specific organization.
 * Reads the organization's email configuration from the database,
 * decrypts credentials, and creates the appropriate provider.
 */
export async function getEmailProviderForOrg(orgId: string): Promise<EmailProvider> {
  // Check cache first
  const cached = providerCache.get(orgId);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return cached.provider;
  }

  // Fetch organization from database
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);

  if (!org) {
    logger.warn(`Organization ${orgId} not found, using console provider`, { orgId });
    return new ConsoleProvider();
  }

  const providerType = org.emailProvider as EmailProviderType;
  const fromAddress = org.emailFromAddress || "noreply@fyren.dev";

  let provider: EmailProvider;

  switch (providerType) {
    case "smtp": {
      if (!org.emailConfig) {
        logger.warn(`SMTP config missing for org ${orgId}, using console provider`, { orgId });
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      if (!isEncryptionAvailable()) {
        logger.error(`Cannot decrypt SMTP config for org ${orgId}, ENCRYPTION_KEY not set`, {
          orgId,
        });
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      const config = decryptJson<SMTPConfig>(org.emailConfig);
      provider = new SMTPProvider(config, fromAddress);
      break;
    }
    case "sendgrid": {
      if (!org.emailConfig) {
        logger.warn(`SendGrid config missing for org ${orgId}, using console provider`, { orgId });
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      if (!isEncryptionAvailable()) {
        logger.error(`Cannot decrypt SendGrid config for org ${orgId}, ENCRYPTION_KEY not set`, {
          orgId,
        });
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      const config = decryptJson<SendGridConfig>(org.emailConfig);
      provider = new SendGridProvider(config, fromAddress);
      break;
    }
    case "ses": {
      if (!org.emailConfig) {
        logger.warn(`SES config missing for org ${orgId}, using console provider`, { orgId });
        provider = new ConsoleProvider(fromAddress);
        break;
      }
      if (!isEncryptionAvailable()) {
        logger.error(`Cannot decrypt SES config for org ${orgId}, ENCRYPTION_KEY not set`, {
          orgId,
        });
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
  providerCache.set(orgId, { provider, createdAt: Date.now() });

  return provider;
}

/**
 * Clear the cached provider for an organization.
 * Call this when organization email settings are updated.
 */
export function clearProviderCache(orgId: string): void {
  providerCache.delete(orgId);
}

/**
 * Clear all cached providers.
 */
export function clearAllProviderCaches(): void {
  providerCache.clear();
}

export * from "./types";
export type { SMTPConfig } from "./providers/smtp";
export type { SendGridConfig } from "./providers/sendgrid";
export type { SESConfig } from "./providers/ses";
