import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  // Auth (BetterAuth)
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  APP_URL: z.string().url().default("http://localhost:3000"),
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
