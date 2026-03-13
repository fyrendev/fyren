import { connect, type TLSSocket, type PeerCertificate } from "tls";
import { logger } from "../logging";

export interface SslCheckOptions {
  host: string;
  port?: number;
  timeoutMs: number;
  warningDays?: number;
}

export interface SslCheckResult {
  status: "up" | "down";
  responseTimeMs: number;
  errorMessage?: string;
  expiresAt?: string;
  daysUntilExpiry?: number;
  issuer?: string;
}

export async function checkSsl(options: SslCheckOptions): Promise<SslCheckResult> {
  const { host, port = 443, timeoutMs, warningDays = 14 } = options;
  const startTime = performance.now();

  return new Promise<SslCheckResult>((resolve) => {
    let socket: TLSSocket | null = null;
    let resolved = false;

    const cleanup = () => {
      if (socket) {
        socket.destroy();
        socket = null;
      }
    };

    const resolveOnce = (result: SslCheckResult) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(result);
      }
    };

    const timeoutId = setTimeout(() => {
      const responseTimeMs = Math.round(performance.now() - startTime);
      resolveOnce({
        status: "down",
        responseTimeMs,
        errorMessage: `Connection timed out after ${timeoutMs}ms`,
      });
    }, timeoutMs);

    try {
      socket = connect(
        {
          host,
          port,
          servername: host, // SNI support
          rejectUnauthorized: false, // We want to check the cert even if it's invalid
        },
        () => {
          const responseTimeMs = Math.round(performance.now() - startTime);
          clearTimeout(timeoutId);

          try {
            const cert = socket?.getPeerCertificate() as PeerCertificate | undefined;

            if (!cert || !cert.valid_to) {
              resolveOnce({
                status: "down",
                responseTimeMs,
                errorMessage: "Could not retrieve certificate information",
              });
              return;
            }

            const expiresAt = new Date(cert.valid_to);
            const now = new Date();
            const daysUntilExpiry = Math.floor(
              (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            const issuer = cert.issuer
              ? Object.entries(cert.issuer)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")
              : undefined;

            // Check if certificate is expired or about to expire
            if (daysUntilExpiry < 0) {
              logger.error(
                `SSL certificate expired for ${host}: ${Math.abs(daysUntilExpiry)} days ago`,
                {
                  host,
                  port,
                  daysUntilExpiry,
                  expiresAt: expiresAt.toISOString(),
                }
              );
              resolveOnce({
                status: "down",
                responseTimeMs,
                errorMessage: `Certificate expired ${Math.abs(daysUntilExpiry)} days ago`,
                expiresAt: expiresAt.toISOString(),
                daysUntilExpiry,
                issuer,
              });
              return;
            }

            if (daysUntilExpiry < warningDays) {
              logger.error(`SSL certificate expiring soon for ${host}: ${daysUntilExpiry} days`, {
                host,
                port,
                daysUntilExpiry,
                warningDays,
                expiresAt: expiresAt.toISOString(),
              });
              resolveOnce({
                status: "down",
                responseTimeMs,
                errorMessage: `Certificate expires in ${daysUntilExpiry} days (warning threshold: ${warningDays} days)`,
                expiresAt: expiresAt.toISOString(),
                daysUntilExpiry,
                issuer,
              });
              return;
            }

            resolveOnce({
              status: "up",
              responseTimeMs,
              expiresAt: expiresAt.toISOString(),
              daysUntilExpiry,
              issuer,
            });
          } catch (err) {
            resolveOnce({
              status: "down",
              responseTimeMs,
              errorMessage: err instanceof Error ? err.message : "Failed to parse certificate",
            });
          }
        }
      );

      socket.on("error", (err) => {
        const responseTimeMs = Math.round(performance.now() - startTime);
        clearTimeout(timeoutId);
        logger.error(`SSL check error for ${host}: ${err.message}`, {
          host,
          port,
          errorName: err.name,
          responseTimeMs,
        });
        resolveOnce({
          status: "down",
          responseTimeMs,
          errorMessage: err.message,
        });
      });

      socket.on("timeout", () => {
        const responseTimeMs = Math.round(performance.now() - startTime);
        clearTimeout(timeoutId);
        resolveOnce({
          status: "down",
          responseTimeMs,
          errorMessage: `Connection timed out after ${timeoutMs}ms`,
        });
      });

      socket.setTimeout(timeoutMs);
    } catch (err) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      clearTimeout(timeoutId);
      resolveOnce({
        status: "down",
        responseTimeMs,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });
}

export function parseHost(url: string): { host: string; port?: number } | null {
  // Handle formats like "host", "host:port", "https://host", "https://host:port"
  let cleanUrl = url;

  if (url.startsWith("https://")) {
    cleanUrl = url.slice(8);
  } else if (url.startsWith("http://")) {
    cleanUrl = url.slice(7);
  }

  // Remove path if present
  const pathIndex = cleanUrl.indexOf("/");
  if (pathIndex !== -1) {
    cleanUrl = cleanUrl.slice(0, pathIndex);
  }

  const parts = cleanUrl.split(":");
  if (parts.length === 1 && parts[0]) {
    return { host: parts[0] };
  }

  if (parts.length === 2 && parts[0] && parts[1]) {
    const port = parseInt(parts[1], 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      return null;
    }
    return { host: parts[0], port };
  }

  return null;
}
