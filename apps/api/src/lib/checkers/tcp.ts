import { connect, type Socket } from "net";

export interface TcpCheckOptions {
  host: string;
  port: number;
  timeoutMs: number;
}

export interface CheckResult {
  status: "up" | "down";
  responseTimeMs: number;
  errorMessage?: string;
}

export async function checkTcp(options: TcpCheckOptions): Promise<CheckResult> {
  const { host, port, timeoutMs } = options;
  const startTime = performance.now();

  return new Promise<CheckResult>((resolve) => {
    let socket: Socket | null = null;
    let resolved = false;

    const cleanup = () => {
      if (socket) {
        socket.destroy();
        socket = null;
      }
    };

    const resolveOnce = (result: CheckResult) => {
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
      socket = connect({ host, port }, () => {
        const responseTimeMs = Math.round(performance.now() - startTime);
        clearTimeout(timeoutId);
        resolveOnce({
          status: "up",
          responseTimeMs,
        });
      });

      socket.on("error", (err) => {
        const responseTimeMs = Math.round(performance.now() - startTime);
        clearTimeout(timeoutId);
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

export function parseHostPort(url: string): { host: string; port: number } | null {
  // Handle formats like "host:port" or "tcp://host:port"
  let hostPort = url;
  if (url.startsWith("tcp://")) {
    hostPort = url.slice(6);
  }

  const parts = hostPort.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const port = parseInt(parts[1], 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    return null;
  }

  return { host: parts[0], port };
}
