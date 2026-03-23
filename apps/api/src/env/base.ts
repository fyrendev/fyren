import { z } from "zod";

/**
 * Base environment schema — shared infrastructure env vars
 * used by both the API server and worker processes.
 */
export const baseEnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Comma-separated list of trusted proxy IPs (e.g., "10.0.0.1,172.16.0.0/12")
  // Only trust X-Forwarded-For when request comes from these IPs
  TRUSTED_PROXIES: z.string().optional(),

  // Allowed origins for widget embedding (CSP frame-ancestors, default: "*")
  // Space-separated list of origins, e.g. "https://example.com https://other.com"
  WIDGET_ALLOWED_ORIGINS: z.string().optional(),

  // Encryption key for sensitive data (64 hex chars = 32 bytes)
  ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]+$/, "Must be hexadecimal")
    .optional(),

  // Logging Configuration
  LOG_PROVIDER: z.enum(["console", "loki", "otlp"]).default("console"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_SERVICE_NAME: z.string().default("fyren-api"),

  // Loki Configuration (when LOG_PROVIDER=loki)
  LOKI_URL: z.string().url().optional(),
  LOKI_USERNAME: z.string().optional(),
  LOKI_PASSWORD: z.string().optional(),
  LOKI_TENANT_ID: z.string().optional(),

  // OTLP Configuration (when LOG_PROVIDER=otlp)
  OTLP_ENDPOINT: z.string().url().optional(),
  OTLP_HEADERS: z.string().optional(), // JSON string of headers
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

function parseBaseEnv(): BaseEnv {
  const result = baseEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = parseBaseEnv();
