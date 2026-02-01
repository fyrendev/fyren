/**
 * Logging configuration loader
 *
 * Loads logging configuration from database with fallback to environment variables.
 * This allows runtime configuration of logging without restarting the server.
 */

import type { LoggerConfig, LogLevel, LogProvider } from "./types";
import { db } from "@fyrendev/db";
import { decryptJson, isEncryptionAvailable } from "../encryption";
import { env } from "../../env";

interface LokiConfig {
  username?: string;
  password?: string;
  tenantId?: string;
}

interface OtlpConfig {
  headers?: Record<string, string>;
}

/**
 * Load logging configuration from environment variables
 */
export function loadConfigFromEnv(): LoggerConfig {
  return {
    provider: env.LOG_PROVIDER,
    level: env.LOG_LEVEL,
    serviceName: env.LOG_SERVICE_NAME,
    lokiUrl: env.LOKI_URL,
    lokiUsername: env.LOKI_USERNAME,
    lokiPassword: env.LOKI_PASSWORD,
    lokiTenantId: env.LOKI_TENANT_ID,
    otlpEndpoint: env.OTLP_ENDPOINT,
    otlpHeaders: env.OTLP_HEADERS ? JSON.parse(env.OTLP_HEADERS) : undefined,
  };
}

/**
 * Load logging configuration from database
 * Returns null if no settings exist in the database
 */
export async function loadConfigFromDb(): Promise<LoggerConfig | null> {
  try {
    const settings = await db.query.systemSettings.findFirst();

    if (!settings) {
      return null;
    }

    // Build base config
    const config: LoggerConfig = {
      provider: settings.logProvider as LogProvider,
      level: settings.logLevel as LogLevel,
      serviceName: settings.logServiceName,
    };

    // Add Loki config if available
    if (settings.lokiUrl) {
      config.lokiUrl = settings.lokiUrl;

      if (settings.lokiConfig && isEncryptionAvailable()) {
        try {
          const lokiSecrets = decryptJson<LokiConfig>(settings.lokiConfig);
          config.lokiUsername = lokiSecrets.username;
          config.lokiPassword = lokiSecrets.password;
          config.lokiTenantId = lokiSecrets.tenantId;
        } catch {
          console.warn("[Logger] Failed to decrypt Loki config");
        }
      }
    }

    // Add OTLP config if available
    if (settings.otlpEndpoint) {
      config.otlpEndpoint = settings.otlpEndpoint;

      if (settings.otlpConfig && isEncryptionAvailable()) {
        try {
          const otlpSecrets = decryptJson<OtlpConfig>(settings.otlpConfig);
          config.otlpHeaders = otlpSecrets.headers;
        } catch {
          console.warn("[Logger] Failed to decrypt OTLP config");
        }
      }
    }

    return config;
  } catch (error) {
    console.warn("[Logger] Failed to load config from database:", error);
    return null;
  }
}

/**
 * Load logging configuration with fallback chain:
 * 1. Database (if available and configured)
 * 2. Environment variables (fallback)
 */
export async function loadConfig(): Promise<{ config: LoggerConfig; source: "database" | "env" }> {
  // Try database first
  const dbConfig = await loadConfigFromDb();
  if (dbConfig) {
    return { config: dbConfig, source: "database" };
  }

  // Fall back to environment variables
  return { config: loadConfigFromEnv(), source: "env" };
}
