/**
 * System Settings Service
 *
 * Manages global system configuration including logging settings.
 * The system_settings table is a singleton (single row for the entire instance).
 */

import { db, systemSettings, type SystemSettings } from "@fyrendev/db";
import { eq } from "@fyrendev/db";
import { encryptJson, decryptJson, isEncryptionAvailable } from "../lib/encryption";
import type { LoggerConfig, LogLevel, LogProvider } from "../lib/logging/types";

export interface LokiConfigInput {
  username?: string;
  password?: string;
  tenantId?: string;
}

export interface OtlpConfigInput {
  headers?: Record<string, string>;
}

export interface LoggingConfigInput {
  logProvider: LogProvider;
  logLevel: LogLevel;
  logServiceName?: string;
  lokiUrl?: string | null;
  lokiConfig?: LokiConfigInput | null;
  otlpEndpoint?: string | null;
  otlpConfig?: OtlpConfigInput | null;
}

export interface LoggingConfigResponse {
  logProvider: LogProvider;
  logLevel: LogLevel;
  logServiceName: string;
  lokiUrl: string | null;
  lokiConfigured: boolean; // Never expose actual credentials
  otlpEndpoint: string | null;
  otlpConfigured: boolean; // Never expose actual credentials
  updatedAt: string;
  updatedBy: string | null;
}

export const SystemSettingsService = {
  /**
   * Get the current system settings (creates default if none exist)
   */
  async get(): Promise<SystemSettings> {
    // Try to get existing settings
    const existing = await db.query.systemSettings.findFirst();
    if (existing) {
      return existing;
    }

    // Create default settings if none exist
    const [created] = await db.insert(systemSettings).values({}).returning();

    return created!;
  },

  /**
   * Get logging configuration for API response (never exposes secrets)
   */
  async getLoggingConfig(): Promise<LoggingConfigResponse> {
    const settings = await this.get();

    return {
      logProvider: settings.logProvider as LogProvider,
      logLevel: settings.logLevel as LogLevel,
      logServiceName: settings.logServiceName,
      lokiUrl: settings.lokiUrl,
      lokiConfigured: !!settings.lokiConfig,
      otlpEndpoint: settings.otlpEndpoint,
      otlpConfigured: !!settings.otlpConfig,
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy,
    };
  },

  /**
   * Update logging configuration
   */
  async updateLoggingConfig(
    input: LoggingConfigInput,
    userId?: string
  ): Promise<LoggingConfigResponse> {
    const existing = await this.get();

    // Prepare encrypted configs if provided
    let encryptedLokiConfig: string | null | undefined = undefined;
    let encryptedOtlpConfig: string | null | undefined = undefined;

    if (input.lokiConfig !== undefined) {
      if (input.lokiConfig === null) {
        encryptedLokiConfig = null;
      } else if (Object.keys(input.lokiConfig).length > 0) {
        if (!isEncryptionAvailable()) {
          throw new Error("ENCRYPTION_KEY required for storing logging credentials");
        }
        encryptedLokiConfig = encryptJson(input.lokiConfig);
      }
    }

    if (input.otlpConfig !== undefined) {
      if (input.otlpConfig === null) {
        encryptedOtlpConfig = null;
      } else if (input.otlpConfig.headers && Object.keys(input.otlpConfig.headers).length > 0) {
        if (!isEncryptionAvailable()) {
          throw new Error("ENCRYPTION_KEY required for storing logging credentials");
        }
        encryptedOtlpConfig = encryptJson(input.otlpConfig);
      }
    }

    const updateData: Partial<typeof systemSettings.$inferInsert> = {
      logProvider: input.logProvider,
      logLevel: input.logLevel,
      updatedAt: new Date(),
      updatedBy: userId || null,
    };

    if (input.logServiceName !== undefined) {
      updateData.logServiceName = input.logServiceName;
    }

    if (input.lokiUrl !== undefined) {
      updateData.lokiUrl = input.lokiUrl;
    }

    if (encryptedLokiConfig !== undefined) {
      updateData.lokiConfig = encryptedLokiConfig;
    }

    if (input.otlpEndpoint !== undefined) {
      updateData.otlpEndpoint = input.otlpEndpoint;
    }

    if (encryptedOtlpConfig !== undefined) {
      updateData.otlpConfig = encryptedOtlpConfig;
    }

    await db.update(systemSettings).set(updateData).where(eq(systemSettings.id, existing.id));

    return this.getLoggingConfig();
  },

  /**
   * Build LoggerConfig from database settings (includes decrypted secrets)
   * Used internally for initializing/reinitializing the logger
   */
  async buildLoggerConfig(): Promise<LoggerConfig | null> {
    const settings = await db.query.systemSettings.findFirst();
    if (!settings) {
      return null;
    }

    const config: LoggerConfig = {
      provider: settings.logProvider as LogProvider,
      level: settings.logLevel as LogLevel,
      serviceName: settings.logServiceName,
    };

    // Add Loki settings
    if (settings.lokiUrl) {
      config.lokiUrl = settings.lokiUrl;

      if (settings.lokiConfig && isEncryptionAvailable()) {
        try {
          const lokiSecrets = decryptJson<LokiConfigInput>(settings.lokiConfig);
          config.lokiUsername = lokiSecrets.username;
          config.lokiPassword = lokiSecrets.password;
          config.lokiTenantId = lokiSecrets.tenantId;
        } catch {
          console.warn("[SystemSettings] Failed to decrypt Loki config");
        }
      }
    }

    // Add OTLP settings
    if (settings.otlpEndpoint) {
      config.otlpEndpoint = settings.otlpEndpoint;

      if (settings.otlpConfig && isEncryptionAvailable()) {
        try {
          const otlpSecrets = decryptJson<OtlpConfigInput>(settings.otlpConfig);
          config.otlpHeaders = otlpSecrets.headers;
        } catch {
          console.warn("[SystemSettings] Failed to decrypt OTLP config");
        }
      }
    }

    return config;
  },
};
