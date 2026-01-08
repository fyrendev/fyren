import { createAuthClient } from "better-auth/react";

// For cross-subdomain setups (e.g., API at status-api.dotly.se, web at status.dotly.se):
// - Use NEXT_PUBLIC_AUTH_URL pointing to the API domain
// - Better Auth's default basePath is /api/auth
//
// For same-domain setups (e.g., both at status.dotly.se with /api path routing):
// - Use NEXT_PUBLIC_APP_URL pointing to the root domain
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
});

export const { signIn, signUp, signOut, useSession } = authClient;
