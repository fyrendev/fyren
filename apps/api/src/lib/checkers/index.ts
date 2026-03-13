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
import { logger } from "../logging";

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
  const context = { monitorId: monitor.id, monitorType: monitor.type, monitorUrl: monitor.url };

  logger.debug(`Starting ${monitor.type} check for ${monitor.url}`, context);

  let result: CheckResult;

  switch (monitor.type) {
    case "http":
      result = await checkHttp({
        url: monitor.url,
        timeoutMs: monitor.timeoutMs,
        expectedStatusCode: monitor.expectedStatusCode ?? undefined,
        headers: monitor.headers ?? undefined,
      });
      break;

    case "tcp": {
      const hostPort = parseHostPort(monitor.url);
      if (!hostPort) {
        logger.error(`Invalid TCP URL format: ${monitor.url}`, context);
        return {
          status: "down",
          responseTimeMs: 0,
          errorMessage: `Invalid TCP URL format: ${monitor.url}. Expected format: host:port`,
        };
      }
      result = await checkTcp({
        host: hostPort.host,
        port: hostPort.port,
        timeoutMs: monitor.timeoutMs,
      });
      break;
    }

    case "ssl_expiry": {
      const hostInfo = parseHost(monitor.url);
      if (!hostInfo) {
        logger.error(`Invalid SSL URL format: ${monitor.url}`, context);
        return {
          status: "down",
          responseTimeMs: 0,
          errorMessage: `Invalid SSL URL format: ${monitor.url}`,
        };
      }
      result = await checkSsl({
        host: hostInfo.host,
        port: hostInfo.port,
        timeoutMs: monitor.timeoutMs,
      });
      break;
    }

    case "nats": {
      const natsUrl = parseNatsUrl(monitor.url);
      if (!natsUrl) {
        logger.error(`Invalid NATS URL format: ${monitor.url}`, context);
        return {
          status: "down",
          responseTimeMs: 0,
          errorMessage: `Invalid NATS URL format: ${monitor.url}. Expected format: nats://host:port or host:port`,
        };
      }
      const auth = parseNatsAuthConfig(monitor.headers as Record<string, string> | null);
      result = await checkNats({
        url: monitor.url,
        timeoutMs: monitor.timeoutMs,
        auth,
      });
      break;
    }

    default:
      logger.error(`Unknown monitor type: ${(monitor as Monitor).type}`, context);
      return {
        status: "down",
        responseTimeMs: 0,
        errorMessage: `Unknown monitor type: ${(monitor as Monitor).type}`,
      };
  }

  if (result.status === "down") {
    logger.error(`Check failed for ${monitor.url}: ${result.errorMessage}`, {
      ...context,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
      errorMessage: result.errorMessage,
    });
  } else {
    logger.debug(`Check passed for ${monitor.url} (${result.responseTimeMs}ms)`, {
      ...context,
      responseTimeMs: result.responseTimeMs,
      statusCode: result.statusCode,
    });
  }

  return result;
}

export { checkHttp, checkTcp, checkSsl, checkNats };
export type { HttpCheckResult, TcpCheckResult, SslCheckResult, NatsCheckResult };
