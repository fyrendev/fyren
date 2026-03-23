import { z } from "zod";
import { baseEnvSchema } from "./base";

/**
 * API environment schema — extends base with auth and app-specific vars.
 * Used by the Hono API server entry point and route handlers.
 */
export const apiEnvSchema = baseEnvSchema.extend({
  // Auth (BetterAuth)
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3001"),
  APP_URL: z.string().default("http://localhost:3000"), // Can be comma-separated for multiple origins
  // Cookie domain for cross-subdomain auth (e.g., ".example.com")
  // Required when API and web are on different subdomains
  COOKIE_DOMAIN: z.string().optional(),
  // One-time setup token required for initial org creation (prevents instance takeover)
  // Generate with: openssl rand -hex 32
  SETUP_TOKEN: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

function parseApiEnv(): ApiEnv {
  const result = apiEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = parseApiEnv();
