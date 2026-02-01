import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Auth (BetterAuth)
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
  APP_URL: z.string().default("http://localhost:3000"), // Can be comma-separated for multiple origins
  // Cookie domain for cross-subdomain auth (e.g., ".dotly.se")
  // Required when API and web are on different subdomains
  COOKIE_DOMAIN: z.string().optional(),
  // Encryption key for sensitive data (64 hex chars = 32 bytes)
  // Required for storing email provider credentials
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

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
