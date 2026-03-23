import type { Context, Next } from "hono";

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Enable Content-Security-Policy header (default: true) */
  enableCSP?: boolean;
  /** Enable Strict-Transport-Security header (default: true in production) */
  enableHSTS?: boolean;
  /** Allow framing from specific origins (for widgets) */
  frameAncestors?: string[];
}

const defaultConfig: SecurityHeadersConfig = {
  enableCSP: true,
  enableHSTS: process.env.NODE_ENV === "production",
  frameAncestors: [],
};

/**
 * Security headers middleware
 *
 * Adds standard security headers to all responses:
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking (unless overridden for widgets)
 * - X-XSS-Protection: XSS filter for older browsers
 * - Referrer-Policy: Controls referrer information
 * - Permissions-Policy: Restricts browser features
 * - Content-Security-Policy: Controls resource loading
 * - Strict-Transport-Security: Enforces HTTPS (production only)
 */
export function securityHeaders(config: SecurityHeadersConfig = {}) {
  const mergedConfig = { ...defaultConfig, ...config };

  return async (c: Context, next: Next) => {
    await next();

    // Prevent MIME type sniffing
    c.header("X-Content-Type-Options", "nosniff");

    // XSS Protection (for older browsers)
    c.header("X-XSS-Protection", "1; mode=block");

    // Control referrer information
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Restrict browser features
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

    // Frame options / CSP frame-ancestors
    if (mergedConfig.frameAncestors && mergedConfig.frameAncestors.length > 0) {
      // Allow framing from specified origins (for widgets)
      c.header(
        "Content-Security-Policy",
        `frame-ancestors 'self' ${mergedConfig.frameAncestors.join(" ")}`
      );
    } else {
      // Default: prevent framing
      c.header("X-Frame-Options", "DENY");
    }

    // Content Security Policy
    if (mergedConfig.enableCSP) {
      // Basic CSP that allows inline styles (needed for many frameworks)
      const cspDirectives = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ];

      // Override frame-ancestors if widget origins specified
      if (mergedConfig.frameAncestors && mergedConfig.frameAncestors.length > 0) {
        cspDirectives[cspDirectives.length - 1] =
          `frame-ancestors 'self' ${mergedConfig.frameAncestors.join(" ")}`;
      }

      c.header("Content-Security-Policy", cspDirectives.join("; "));
    }

    // HTTP Strict Transport Security (production only)
    if (mergedConfig.enableHSTS) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }

    // Remove server identification headers
    c.res.headers.delete("X-Powered-By");
    c.res.headers.delete("Server");
  };
}

/**
 * Widget-friendly security headers
 *
 * Allows embedding in iframes from configurable origins (default: any).
 * Use this only for widget/embed endpoints.
 *
 * @param getFrameAncestors - Optional async function to resolve allowed origins.
 *   Defaults to reading from the organization's widgetAllowedOrigins setting.
 *   Falls back to "*" (allow all) on failure.
 */
export function widgetSecurityHeaders(getFrameAncestors?: () => Promise<string>) {
  const resolveOrigins =
    getFrameAncestors ??
    (async () => {
      try {
        const { getOrganization } = await import("../lib/organization");
        const org = await getOrganization();
        return org.widgetAllowedOrigins || "*";
      } catch {
        return "*";
      }
    });

  return async (c: Context, next: Next) => {
    await next();

    const frameAncestors = await resolveOrigins();

    // Prevent MIME type sniffing
    c.header("X-Content-Type-Options", "nosniff");

    // XSS Protection
    c.header("X-XSS-Protection", "1; mode=block");

    // Widget CSP: no unsafe-inline for scripts (widget JS is served as a file),
    // but allow unsafe-inline for styles (widget styles are often inline).
    c.header(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors ${frameAncestors}`
    );

    // Remove X-Frame-Options to allow embedding
    c.res.headers.delete("X-Frame-Options");

    // Control referrer
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Remove server identification
    c.res.headers.delete("X-Powered-By");
    c.res.headers.delete("Server");
  };
}

/**
 * CORS headers for badge/widget endpoints
 *
 * These endpoints need permissive CORS to allow embedding.
 */
export function widgetCorsHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Allow cross-origin requests for badges/widgets
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Access-Control-Max-Age", "86400");
  };
}

/**
 * Cache headers for static-like content
 */
export function cacheHeaders(maxAge: number = 60) {
  return async (c: Context, next: Next) => {
    await next();

    c.header("Cache-Control", `public, max-age=${maxAge}`);
  };
}
