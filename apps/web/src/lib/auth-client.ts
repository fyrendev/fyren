import { createAuthClient } from "better-auth/react";

// For cross-subdomain setups (e.g., API at api.example.com, web at status.example.com):
// - Use NEXT_PUBLIC_AUTH_URL pointing to the API domain
// - Better Auth's default basePath is /api/auth
//
// For same-domain setups (e.g., both at status.example.com with /api path routing):
// - Use NEXT_PUBLIC_APP_URL pointing to the root domain
export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001",
});

export const { signIn, signUp, signOut, useSession } = authClient;
