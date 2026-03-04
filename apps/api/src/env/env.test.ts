import { describe, test, expect } from "bun:test";
import { baseEnvSchema } from "./base";
import { apiEnvSchema } from "./api";
import { workerEnvSchema } from "./worker";

const validBase = {
  DATABASE_URL: "postgres://localhost:5432/fyren",
  REDIS_URL: "redis://localhost:6379",
};

describe("baseEnvSchema", () => {
  test("parses with minimal required fields", () => {
    const result = baseEnvSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  test("applies defaults", () => {
    const result = baseEnvSchema.parse(validBase);
    expect(result.PORT).toBe(3001);
    expect(result.NODE_ENV).toBe("development");
    expect(result.LOG_PROVIDER).toBe("console");
    expect(result.LOG_LEVEL).toBe("info");
    expect(result.LOG_SERVICE_NAME).toBe("fyren-api");
  });

  test("does not require auth fields", () => {
    const result = baseEnvSchema.safeParse(validBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("BETTER_AUTH_SECRET");
      expect(result.data).not.toHaveProperty("BETTER_AUTH_URL");
      expect(result.data).not.toHaveProperty("APP_URL");
      expect(result.data).not.toHaveProperty("COOKIE_DOMAIN");
    }
  });

  test("fails without DATABASE_URL", () => {
    const result = baseEnvSchema.safeParse({ REDIS_URL: "redis://localhost:6379" });
    expect(result.success).toBe(false);
  });

  test("fails without REDIS_URL", () => {
    const result = baseEnvSchema.safeParse({ DATABASE_URL: "postgres://localhost:5432/fyren" });
    expect(result.success).toBe(false);
  });

  test("validates ENCRYPTION_KEY format", () => {
    const result = baseEnvSchema.safeParse({
      ...validBase,
      ENCRYPTION_KEY: "a".repeat(64),
    });
    expect(result.success).toBe(true);

    const invalidLength = baseEnvSchema.safeParse({
      ...validBase,
      ENCRYPTION_KEY: "abc",
    });
    expect(invalidLength.success).toBe(false);

    const invalidChars = baseEnvSchema.safeParse({
      ...validBase,
      ENCRYPTION_KEY: "g".repeat(64),
    });
    expect(invalidChars.success).toBe(false);
  });
});

describe("apiEnvSchema", () => {
  const validApi = {
    ...validBase,
    BETTER_AUTH_SECRET: "a".repeat(32),
  };

  test("requires BETTER_AUTH_SECRET", () => {
    const withoutSecret = apiEnvSchema.safeParse(validBase);
    expect(withoutSecret.success).toBe(false);
  });

  test("requires BETTER_AUTH_SECRET min length 32", () => {
    const tooShort = apiEnvSchema.safeParse({
      ...validBase,
      BETTER_AUTH_SECRET: "short",
    });
    expect(tooShort.success).toBe(false);
  });

  test("parses with BETTER_AUTH_SECRET", () => {
    const result = apiEnvSchema.safeParse(validApi);
    expect(result.success).toBe(true);
  });

  test("applies API-specific defaults", () => {
    const result = apiEnvSchema.parse(validApi);
    expect(result.BETTER_AUTH_URL).toBe("http://localhost:3001");
    expect(result.APP_URL).toBe("http://localhost:3000");
    expect(result.COOKIE_DOMAIN).toBeUndefined();
  });

  test("includes all base fields", () => {
    const result = apiEnvSchema.parse(validApi);
    expect(result.PORT).toBe(3001);
    expect(result.DATABASE_URL).toBe(validBase.DATABASE_URL);
    expect(result.REDIS_URL).toBe(validBase.REDIS_URL);
    expect(result.LOG_PROVIDER).toBe("console");
  });
});

describe("workerEnvSchema", () => {
  test("parses without auth fields", () => {
    const result = workerEnvSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  test("does not require BETTER_AUTH_SECRET", () => {
    const result = workerEnvSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  test("accepts APP_URL", () => {
    const result = workerEnvSchema.parse({
      ...validBase,
      APP_URL: "https://status.example.com",
    });
    expect(result.APP_URL).toBe("https://status.example.com");
  });

  test("defaults APP_URL", () => {
    const result = workerEnvSchema.parse(validBase);
    expect(result.APP_URL).toBe("http://localhost:3000");
  });

  test("includes all base fields", () => {
    const result = workerEnvSchema.parse(validBase);
    expect(result.PORT).toBe(3001);
    expect(result.DATABASE_URL).toBe(validBase.DATABASE_URL);
    expect(result.REDIS_URL).toBe(validBase.REDIS_URL);
  });
});
