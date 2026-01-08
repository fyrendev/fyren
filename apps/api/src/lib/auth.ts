import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, users, sessions, accounts, verifications } from "@fyrendev/db";
import { env } from "../env";

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
  trustedOrigins: [env.APP_URL],

  // Cross-subdomain cookie configuration
  // Required when API and web app are on different subdomains (e.g., api.example.com and app.example.com)
  advanced: {
    crossSubDomainCookies: {
      enabled: !!env.COOKIE_DOMAIN,
      domain: env.COOKIE_DOMAIN, // e.g., ".dotly.se" to share cookies across subdomains
    },
    defaultCookieAttributes: {
      // sameSite "none" is required for cross-origin cookies
      // Only set when using cross-subdomain setup
      sameSite: env.COOKIE_DOMAIN ? "none" : "lax",
      secure: env.NODE_ENV === "production",
    },
  },
});

// Export auth types
export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
