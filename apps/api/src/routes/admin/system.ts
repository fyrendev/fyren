/**
 * System Settings Admin Routes
 *
 * Manages global system configuration including logging settings.
 * All endpoints require owner role for the organization.
 */

import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../../middleware/auth";
import { requireRole } from "../../middleware/session";
import { errorResponse, BadRequestError } from "../../lib/errors";
import { SystemSettingsService } from "../../services/system-settings.service";
import { reinitializeLogger, getLoggerConfig, loadConfigFromEnv } from "../../lib/logging";
import { createAuditLogger } from "../../lib/logging/audit";
import type { AuthUser } from "../../lib/auth";
import type { LogLevel, LogProvider } from "../../lib/logging/types";

type Variables = {
  user?: AuthUser;
  authMethod?: "session" | "api_key" | null;
  requestId?: string;
};

const adminSystem = new Hono<{ Variables: Variables }>();

// Validation schemas
const loggingConfigSchema = z.object({
  logProvider: z.enum(["console", "loki", "otlp"]),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
  logServiceName: z.string().min(1).max(100).optional(),

  // Loki config
  lokiUrl: z.string().url().max(500).nullable().optional(),
  lokiConfig: z
    .object({
      username: z.string().max(255).optional(),
      password: z.string().max(255).optional(),
      tenantId: z.string().max(255).optional(),
    })
    .nullable()
    .optional(),

  // OTLP config
  otlpEndpoint: z.string().url().max(500).nullable().optional(),
  otlpConfig: z
    .object({
      headers: z.record(z.string().max(1000)).optional(),
    })
    .nullable()
    .optional(),
});

// GET /api/v1/admin/system/logging - Get current logging configuration
adminSystem.get("/logging", authMiddleware, requireRole("owner"), async (c) => {
  try {
    const loggingConfig = await SystemSettingsService.getLoggingConfig();
    const currentLoggerState = getLoggerConfig();

    return c.json({
      config: loggingConfig,
      currentSource: currentLoggerState.source,
      currentProvider: currentLoggerState.config?.provider ?? "console",
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// PUT /api/v1/admin/system/logging - Update logging configuration
adminSystem.put("/logging", authMiddleware, requireRole("owner"), async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const data = loggingConfigSchema.parse(body);

    // Validate provider-specific requirements
    if (data.logProvider === "loki" && !data.lokiUrl) {
      throw new BadRequestError("Loki URL is required when using Loki provider");
    }

    if (data.logProvider === "otlp" && !data.otlpEndpoint) {
      throw new BadRequestError("OTLP endpoint is required when using OTLP provider");
    }

    const config = await SystemSettingsService.updateLoggingConfig(
      {
        logProvider: data.logProvider as LogProvider,
        logLevel: data.logLevel as LogLevel,
        logServiceName: data.logServiceName,
        lokiUrl: data.lokiUrl,
        lokiConfig: data.lokiConfig,
        otlpEndpoint: data.otlpEndpoint,
        otlpConfig: data.otlpConfig,
      },
      user?.id
    );

    // Audit log
    const auditLogger = createAuditLogger({
      userId: user?.id,
      requestId: c.get("requestId"),
    });
    auditLogger.settingsUpdated("system", "logging", {
      provider: data.logProvider,
      level: data.logLevel,
    });

    return c.json({
      config,
      message: "Logging configuration updated. Use POST /logging/reload to apply changes.",
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/system/logging/test - Test logging destination
adminSystem.post("/logging/test", authMiddleware, requireRole("owner"), async (c) => {
  try {
    // Build config from DB
    const loggerConfig = await SystemSettingsService.buildLoggerConfig();

    if (!loggerConfig) {
      throw new BadRequestError("No logging configuration found. Save a configuration first.");
    }

    // Validate the config can work
    if (loggerConfig.provider === "loki" && !loggerConfig.lokiUrl) {
      throw new BadRequestError("Loki URL is required for Loki provider");
    }

    if (loggerConfig.provider === "otlp" && !loggerConfig.otlpEndpoint) {
      throw new BadRequestError("OTLP endpoint is required for OTLP provider");
    }

    // Test by attempting to send a test log
    // For now, we validate the configuration is complete
    // A proper test would require actually sending to the destination
    let testResult: { success: boolean; message: string };

    switch (loggerConfig.provider) {
      case "loki":
        // Basic URL validation was already done
        testResult = {
          success: true,
          message: `Loki configuration appears valid. URL: ${loggerConfig.lokiUrl}`,
        };
        break;
      case "otlp":
        testResult = {
          success: true,
          message: `OTLP configuration appears valid. Endpoint: ${loggerConfig.otlpEndpoint}`,
        };
        break;
      case "console":
      default:
        testResult = {
          success: true,
          message: "Console logging is always available.",
        };
    }

    return c.json(testResult);
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/system/logging/reload - Hot-reload logger with saved configuration
adminSystem.post("/logging/reload", authMiddleware, requireRole("owner"), async (c) => {
  try {
    const user = c.get("user");

    // Get config from database
    const dbConfig = await SystemSettingsService.buildLoggerConfig();

    if (dbConfig) {
      // Reinitialize logger with database config
      await reinitializeLogger(dbConfig, "database");

      // Audit log
      const auditLogger = createAuditLogger({
        userId: user?.id,
        requestId: c.get("requestId"),
      });
      auditLogger.settingsUpdated("system", "logging_reload", {
        provider: dbConfig.provider,
        source: "database",
      });

      return c.json({
        success: true,
        message: `Logger reinitialized with ${dbConfig.provider} provider from database configuration.`,
        provider: dbConfig.provider,
        source: "database",
      });
    } else {
      // Fall back to environment config
      const envConfig = loadConfigFromEnv();
      await reinitializeLogger(envConfig, "env");

      return c.json({
        success: true,
        message: `Logger reinitialized with ${envConfig.provider} provider from environment variables (no DB config found).`,
        provider: envConfig.provider,
        source: "env",
      });
    }
  } catch (error) {
    return errorResponse(c, error);
  }
});

// POST /api/v1/admin/system/logging/reset - Reset to environment configuration
adminSystem.post("/logging/reset", authMiddleware, requireRole("owner"), async (c) => {
  try {
    const user = c.get("user");

    // Load from environment and reinitialize
    const envConfig = loadConfigFromEnv();
    await reinitializeLogger(envConfig, "env");

    // Audit log
    const auditLogger = createAuditLogger({
      userId: user?.id,
      requestId: c.get("requestId"),
    });
    auditLogger.settingsUpdated("system", "logging_reset", {
      provider: envConfig.provider,
      source: "env",
    });

    return c.json({
      success: true,
      message: `Logger reset to environment configuration (${envConfig.provider} provider).`,
      provider: envConfig.provider,
      source: "env",
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export { adminSystem };
