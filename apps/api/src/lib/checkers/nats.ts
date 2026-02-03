import { connect, type ConnectionOptions, type NatsConnection } from "nats.ws";

export type NatsAuthType = "none" | "token" | "userpass" | "jwt";

export interface NatsAuthConfig {
  authType?: NatsAuthType;
  token?: string;
  user?: string;
  pass?: string;
  jwt?: string;
  nkeySeed?: string;
}

export interface NatsCheckOptions {
  url: string;
  timeoutMs: number;
  auth?: NatsAuthConfig;
}

export interface CheckResult {
  status: "up" | "down";
  responseTimeMs: number;
  errorMessage?: string;
}

export async function checkNats(options: NatsCheckOptions): Promise<CheckResult> {
  const { url, timeoutMs, auth } = options;
  const startTime = performance.now();

  let connection: NatsConnection | null = null;

  try {
    const connectionOptions: ConnectionOptions = {
      servers: [url],
      timeout: timeoutMs,
      reconnect: false,
      maxReconnectAttempts: 0,
    };

    // Apply authentication based on auth config
    if (auth) {
      switch (auth.authType) {
        case "token":
          if (auth.token) {
            connectionOptions.token = auth.token;
          }
          break;
        case "userpass":
          if (auth.user) {
            connectionOptions.user = auth.user;
          }
          if (auth.pass) {
            connectionOptions.pass = auth.pass;
          }
          break;
        case "jwt":
          if (auth.jwt) {
            connectionOptions.authenticator = jwtAuthenticator(auth.jwt, auth.nkeySeed);
          }
          break;
      }
    }

    connection = await connect(connectionOptions);
    const responseTimeMs = Math.round(performance.now() - startTime);

    // Successfully connected
    await connection.close();
    connection = null;

    return {
      status: "up",
      responseTimeMs,
    };
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);

    // Ensure connection is closed on error
    if (connection) {
      try {
        await connection.close();
      } catch {
        // Ignore close errors
      }
    }

    if (error instanceof Error) {
      // Check for timeout
      if (error.message.includes("timeout") || error.message.includes("TIMEOUT")) {
        return {
          status: "down",
          responseTimeMs,
          errorMessage: `Connection timed out after ${timeoutMs}ms`,
        };
      }

      // Check for auth errors
      if (
        error.message.includes("authorization") ||
        error.message.includes("AUTHORIZATION") ||
        error.message.includes("authentication") ||
        error.message.includes("AUTHENTICATION")
      ) {
        return {
          status: "down",
          responseTimeMs,
          errorMessage: `Authentication failed: ${error.message}`,
        };
      }

      return {
        status: "down",
        responseTimeMs,
        errorMessage: error.message,
      };
    }

    return {
      status: "down",
      responseTimeMs,
      errorMessage: "Unknown error",
    };
  }
}

/**
 * Creates a JWT authenticator function for NATS
 */
function jwtAuthenticator(jwt: string, nkeySeed?: string) {
  return () => {
    return {
      jwt,
      nkey: nkeySeed,
    };
  };
}

/**
 * Parse and validate a NATS URL
 * Accepts formats:
 * - nats://host:port
 * - nats://host (defaults to port 4222)
 * - host:port
 * - host (defaults to port 4222)
 */
export function parseNatsUrl(url: string): { host: string; port: number } | null {
  let cleanUrl = url.trim();

  // Remove nats:// prefix if present
  if (cleanUrl.startsWith("nats://")) {
    cleanUrl = cleanUrl.slice(7);
  }

  // Handle host:port or just host
  const parts = cleanUrl.split(":");

  if (parts.length === 1) {
    // Just host, use default port
    const host = parts[0];
    if (!host || host.length === 0) {
      return null;
    }
    return { host, port: 4222 };
  }

  if (parts.length === 2) {
    const host = parts[0];
    const portStr = parts[1];

    if (!host || host.length === 0 || !portStr) {
      return null;
    }

    const port = parseInt(portStr, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return null;
    }

    return { host, port };
  }

  // More than 2 parts is invalid
  return null;
}

/**
 * Parse auth configuration from headers JSON field
 */
export function parseNatsAuthConfig(
  headers: Record<string, string> | null | undefined
): NatsAuthConfig | undefined {
  if (!headers) {
    return undefined;
  }

  const authType = headers.auth_type as NatsAuthType | undefined;
  if (!authType || authType === "none") {
    return undefined;
  }

  return {
    authType,
    token: headers.token,
    user: headers.user,
    pass: headers.pass,
    jwt: headers.jwt,
    nkeySeed: headers.nkey_seed,
  };
}
