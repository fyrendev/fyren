import type { Monitor } from "@fyrendev/db";
import { checkHttp, type CheckResult as HttpCheckResult } from "./http";
import { checkTcp, parseHostPort, type CheckResult as TcpCheckResult } from "./tcp";
import { checkSsl, parseHost, type SslCheckResult } from "./ssl";
import {
  checkNats,
  parseNatsUrl,
  parseNatsAuthConfig,
  type CheckResult as NatsCheckResult,
} from "./nats";

export type CheckResult = {
  status: "up" | "down";
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
  // SSL specific
  expiresAt?: string;
  daysUntilExpiry?: number;
  issuer?: string;
};

export async function executeCheck(monitor: Monitor): Promise<CheckResult> {
  switch (monitor.type) {
    case "http":
      return checkHttp({
        url: monitor.url,
        timeoutMs: monitor.timeoutMs,
        expectedStatusCode: monitor.expectedStatusCode ?? undefined,
        headers: monitor.headers ?? undefined,
      });

    case "tcp": {
      const hostPort = parseHostPort(monitor.url);
      if (!hostPort) {
        return {
          status: "down",
          responseTimeMs: 0,
          errorMessage: `Invalid TCP URL format: ${monitor.url}. Expected format: host:port`,
        };
      }
      return checkTcp({
        host: hostPort.host,
        port: hostPort.port,
        timeoutMs: monitor.timeoutMs,
      });
    }

    case "ssl_expiry": {
      const hostInfo = parseHost(monitor.url);
      if (!hostInfo) {
        return {
          status: "down",
          responseTimeMs: 0,
          errorMessage: `Invalid SSL URL format: ${monitor.url}`,
        };
      }
      return checkSsl({
        host: hostInfo.host,
        port: hostInfo.port,
        timeoutMs: monitor.timeoutMs,
      });
    }

    case "nats": {
      const natsUrl = parseNatsUrl(monitor.url);
      if (!natsUrl) {
        return {
          status: "down",
          responseTimeMs: 0,
          errorMessage: `Invalid NATS URL format: ${monitor.url}. Expected format: nats://host:port or host:port`,
        };
      }
      const auth = parseNatsAuthConfig(monitor.headers as Record<string, string> | null);
      return checkNats({
        url: monitor.url,
        timeoutMs: monitor.timeoutMs,
        auth,
      });
    }

    default:
      return {
        status: "down",
        responseTimeMs: 0,
        errorMessage: `Unknown monitor type: ${(monitor as Monitor).type}`,
      };
  }
}

export { checkHttp, checkTcp, checkSsl, checkNats };
export type { HttpCheckResult, TcpCheckResult, SslCheckResult, NatsCheckResult };
