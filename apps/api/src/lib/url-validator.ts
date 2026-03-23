import { logger } from "./logging";

/**
 * Private/reserved IPv4 and IPv6 ranges that should be blocked
 * to prevent SSRF attacks against internal infrastructure.
 */
const BLOCKED_IPV4_RANGES = [
  { prefix: "127.", label: "loopback" },
  { prefix: "10.", label: "private (10.0.0.0/8)" },
  { prefix: "0.", label: "unspecified" },
  { prefix: "169.254.", label: "link-local / IMDS" },
] as const;

const BLOCKED_IPV4_172 = { min: 16, max: 31 }; // 172.16.0.0/12
const BLOCKED_IPV4_192 = "192.168."; // 192.168.0.0/16

const BLOCKED_IPV6 = ["::1", "::ffff:127.0.0.1", "fe80:", "fc00:", "fd00:"] as const;

const BLOCKED_HOSTNAMES = ["localhost", "metadata.google.internal"] as const;

function isBlockedIPv4(ip: string): boolean {
  for (const range of BLOCKED_IPV4_RANGES) {
    if (ip.startsWith(range.prefix)) return true;
  }

  if (ip.startsWith(BLOCKED_IPV4_192)) return true;

  // Check 172.16.0.0/12
  if (ip.startsWith("172.")) {
    const secondOctet = parseInt(ip.split(".")[1] ?? "", 10);
    if (secondOctet >= BLOCKED_IPV4_172.min && secondOctet <= BLOCKED_IPV4_172.max) {
      return true;
    }
  }

  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  return BLOCKED_IPV6.some((prefix) => normalized.startsWith(prefix));
}

function isBlockedIP(ip: string): boolean {
  return isBlockedIPv4(ip) || isBlockedIPv6(ip);
}

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a URL does not resolve to a private/internal IP address.
 * This prevents SSRF attacks where an attacker could probe internal services
 * (cloud IMDS at 169.254.169.254, localhost databases, internal network hosts).
 *
 * DNS resolution is performed to catch cases where a public hostname
 * resolves to a private IP (DNS rebinding).
 */
export async function validateExternalUrl(url: string): Promise<UrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { valid: false, error: "Invalid URL" };
  }

  const hostname = parsed.hostname;

  // Block known private hostnames
  const lowerHostname = hostname.toLowerCase();
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (lowerHostname === blocked) {
      return { valid: false, error: `Hostname '${hostname}' is not allowed` };
    }
  }

  // If the hostname is already an IP literal, check directly
  if (isBlockedIP(hostname)) {
    return {
      valid: false,
      error: `IP address '${hostname}' is not allowed (private/reserved range)`,
    };
  }

  // Resolve hostname to check actual IPs (catches DNS rebinding)
  try {
    const addresses = await resolveHostname(hostname);

    for (const addr of addresses) {
      if (isBlockedIP(addr)) {
        logger.warn("SSRF blocked: hostname resolved to private IP", {
          hostname,
          resolvedIp: addr,
          url,
        });
        return {
          valid: false,
          error: `Hostname '${hostname}' resolves to private IP '${addr}'`,
        };
      }
    }
  } catch (err) {
    return {
      valid: false,
      error: `Failed to resolve hostname '${hostname}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return { valid: true };
}

async function resolveHostname(hostname: string): Promise<string[]> {
  const dns = await import("node:dns/promises");
  try {
    return await dns.resolve4(hostname);
  } catch {
    // If IPv4 resolution fails, try IPv6
    try {
      return await dns.resolve6(hostname);
    } catch {
      throw new Error(`DNS resolution failed for ${hostname}`);
    }
  }
}

// Re-export for testing
export { isBlockedIP, isBlockedIPv4, isBlockedIPv6 };
