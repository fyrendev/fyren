import { describe, it, expect } from "bun:test";
import { z } from "zod";

// Re-create the schema here to test it in isolation without triggering the
// module-level parseEnv() call which would exit the process on invalid env.
const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
  APP_URL: z.string().default("http://localhost:3000"),
  COOKIE_DOMAIN: z.string().optional(),
  ENCRYPTION_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-fA-F]+$/, "Must be hexadecimal")
    .optional(),
  LOG_PROVIDER: z.enum(["console", "loki", "otlp"]).default("console"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_SERVICE_NAME: z.string().default("fyren-api"),
  LOKI_URL: z.string().url().optional(),
  LOKI_USERNAME: z.string().optional(),
  LOKI_PASSWORD: z.string().optional(),
  LOKI_TENANT_ID: z.string().optional(),
  OTLP_ENDPOINT: z.string().url().optional(),
  OTLP_HEADERS: z.string().optional(),
});

const baseEnv = {
  DATABASE_URL: "postgresql://localhost:5432/fyren",
  REDIS_URL: "redis://localhost:6379",
};

describe("env schema", () => {
  it("parses successfully without BETTER_AUTH_SECRET (worker mode)", () => {
    const result = envSchema.safeParse(baseEnv);
    expect(result.success).toBe(true);
    expect(result.data?.BETTER_AUTH_SECRET).toBeUndefined();
  });

  it("parses successfully with BETTER_AUTH_SECRET (API mode)", () => {
    const secret = "a".repeat(32);
    const result = envSchema.safeParse({
      ...baseEnv,
      BETTER_AUTH_SECRET: secret,
    });
    expect(result.success).toBe(true);
    expect(result.data?.BETTER_AUTH_SECRET).toBe(secret);
  });

  it("rejects BETTER_AUTH_SECRET shorter than 32 characters", () => {
    const result = envSchema.safeParse({
      ...baseEnv,
      BETTER_AUTH_SECRET: "too-short",
    });
    expect(result.success).toBe(false);
  });
});
