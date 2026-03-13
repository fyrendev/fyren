import { logger } from "../logging";

export interface HttpCheckOptions {
  url: string;
  timeoutMs: number;
  expectedStatusCode?: number;
  headers?: Record<string, string>;
}

export interface CheckResult {
  status: "up" | "down";
  responseTimeMs: number;
  statusCode?: number;
  errorMessage?: string;
}

export async function checkHttp(options: HttpCheckOptions): Promise<CheckResult> {
  const { url, timeoutMs, expectedStatusCode = 200, headers = {} } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
      redirect: "follow",
    });

    const responseTimeMs = Math.round(performance.now() - startTime);
    clearTimeout(timeoutId);

    // Check if status code matches expected, or if any 2xx is acceptable
    const isExpectedStatus = expectedStatusCode
      ? response.status === expectedStatusCode
      : response.status >= 200 && response.status < 300;

    if (isExpectedStatus) {
      return {
        status: "up",
        responseTimeMs,
        statusCode: response.status,
      };
    }

    logger.error(`HTTP check status mismatch for ${url}`, {
      url,
      expectedStatusCode,
      actualStatusCode: response.status,
      responseTimeMs,
    });

    return {
      status: "down",
      responseTimeMs,
      statusCode: response.status,
      errorMessage: `Expected status ${expectedStatusCode}, got ${response.status}`,
    };
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        logger.error(`HTTP check timed out for ${url} after ${timeoutMs}ms`, {
          url,
          timeoutMs,
          responseTimeMs,
        });

        return {
          status: "down",
          responseTimeMs,
          errorMessage: `Request timed out after ${timeoutMs}ms`,
        };
      }

      logger.error(`HTTP check error for ${url}: ${error.message}`, {
        url,
        errorName: error.name,
        responseTimeMs,
      });

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
