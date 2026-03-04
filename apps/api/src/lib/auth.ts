import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, users, sessions, accounts, verifications } from "@fyrendev/db";
import { env } from "../env";

if (!env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET is required for auth initialization");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  // Email + password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // TODO: Enable when email service is set up
    minPasswordLength: 8,
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Base URL for auth callbacks
  baseURL: env.BETTER_AUTH_URL,

  // Secret for signing tokens
  secret: env.BETTER_AUTH_SECRET,

  // Trusted origins for CORS
  // Support comma-separated APP_URL for multiple origins (e.g., production + localhost)
  trustedOrigins: [
    "http://localhost:3000",
    ...env.APP_URL.split(",").map((origin) => origin.trim()),
  ].filter((origin, index, arr) => arr.indexOf(origin) === index), // dedupe

  // Cross-subdomain cookie configuration
  // Required when API and web app are on different subdomains (e.g., api.example.com and app.example.com)
  advanced: {
    // Only enable cross-subdomain cookies when COOKIE_DOMAIN is set
    ...(env.COOKIE_DOMAIN && {
      crossSubDomainCookies: {
        enabled: true,
        domain: env.COOKIE_DOMAIN, // e.g., ".example.com" to share cookies across subdomains
      },
      defaultCookieAttributes: {
        // sameSite "none" is required for cross-origin cookies
        sameSite: "none" as const,
        secure: true, // required when sameSite is "none"
      },
    }),
  },
});

// Export auth types
export type Session = typeof auth.$Infer.Session;
// Extend BetterAuth's user type with our custom role field
export type AuthUser = typeof auth.$Infer.Session.user & {
  role?: import("@fyrendev/db").OrgRole | null;
};
