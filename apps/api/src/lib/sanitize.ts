/**
 * Input sanitization utilities for Fyren
 *
 * These functions sanitize user input to prevent XSS, injection attacks,
 * and other security vulnerabilities.
 */

/**
 * Allowed HTML tags for rich text content (incident messages, etc.)
 */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "blockquote",
]);

/**
 * Allowed attributes for HTML tags
 */
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
};

/**
 * Dangerous CSS properties that could be used for attacks
 */
const DANGEROUS_CSS_PATTERNS = [
  // JavaScript execution
  /expression\s*\(/gi,
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  // Data URIs that could contain scripts
  /data\s*:/gi,
  // Behavior/binding
  /behavior\s*:/gi,
  /-moz-binding\s*:/gi,
  // Import external resources
  /@import/gi,
  // URL functions (can load external resources)
  /url\s*\(\s*["']?\s*(?!data:image)/gi,
];

/**
 * HTML entity encoding map
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize HTML content, allowing only safe tags and attributes
 *
 * This is a simple sanitizer. For production use with untrusted content,
 * consider using a battle-tested library like DOMPurify.
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // First, decode any HTML entities to get the actual content
  let result = input;

  // Remove script tags and their contents entirely
  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove style tags and their contents
  result = result.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove event handlers (onclick, onload, etc.)
  result = result.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  result = result.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove javascript: and other dangerous protocols from href/src
  result = result.replace(
    /(href|src)\s*=\s*["']?\s*(javascript|vbscript|data):[^"'\s>]*/gi,
    '$1=""'
  );

  // Process tags - keep allowed tags, strip others
  result = result.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      // Strip disallowed tags entirely
      return "";
    }

    // For allowed tags, sanitize attributes
    const isClosing = match.startsWith("</");
    if (isClosing) {
      return `</${tag}>`;
    }

    // Extract and filter attributes
    const allowedAttrs = ALLOWED_ATTRIBUTES[tag] || new Set();
    const attrMatches = match.match(/\s+([a-z][a-z0-9-]*)\s*=\s*["']([^"']*)["']/gi) || [];

    const safeAttrs = attrMatches
      .map((attr) => {
        const attrMatch = attr.match(/\s+([a-z][a-z0-9-]*)\s*=\s*["']([^"']*)["']/i);
        if (!attrMatch) return null;

        const attrName = attrMatch[1];
        const attrValue = attrMatch[2];
        if (!attrName || attrValue === undefined) return null;

        const lowerAttrName = attrName.toLowerCase();

        if (!allowedAttrs.has(lowerAttrName)) {
          return null;
        }

        // Special handling for href - only allow safe protocols
        if (lowerAttrName === "href") {
          const trimmedValue = attrValue.trim().toLowerCase();
          if (
            !trimmedValue.startsWith("http://") &&
            !trimmedValue.startsWith("https://") &&
            !trimmedValue.startsWith("mailto:") &&
            !trimmedValue.startsWith("/") &&
            !trimmedValue.startsWith("#")
          ) {
            return null;
          }
        }

        // Add rel="noopener noreferrer" to links for security
        if (lowerAttrName === "href") {
          return ` href="${escapeHtml(attrValue)}" rel="noopener noreferrer"`;
        }

        return ` ${lowerAttrName}="${escapeHtml(attrValue)}"`;
      })
      .filter(Boolean)
      .join("");

    return `<${tag}${safeAttrs}>`;
  });

  return result.trim();
}

/**
 * Sanitize plain text - remove all HTML and dangerous content
 */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Remove all HTML tags
  let result = input.replace(/<[^>]*>/g, "");

  // Decode common HTML entities
  result = result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");

  // Escape the result to prevent any HTML injection
  result = escapeHtml(result);

  // Normalize whitespace
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

/**
 * Sanitize custom CSS to prevent XSS and other attacks
 *
 * Removes dangerous CSS patterns while allowing safe styling.
 * Maximum length is enforced to prevent DoS.
 */
export function sanitizeCustomCss(input: string, maxLength: number = 50000): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Enforce maximum length
  let result = input.slice(0, maxLength);

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_CSS_PATTERNS) {
    result = result.replace(pattern, "/* removed */");
  }

  // Remove comments that might contain malicious content
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");

  // Remove HTML tags that might have been embedded
  result = result.replace(/<[^>]*>/g, "");

  // Remove any remaining script-like content
  result = result.replace(/<\/?\s*script/gi, "");

  return result.trim();
}

/**
 * Validate and sanitize a URL
 *
 * Returns null if the URL is invalid or uses a dangerous protocol.
 */
export function sanitizeUrl(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();

  // Only allow http and https protocols
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Validate a hex color code
 */
export function isValidHexColor(input: string): boolean {
  if (!input || typeof input !== "string") {
    return false;
  }

  return /^#[0-9a-fA-F]{6}$/.test(input.trim());
}

/**
 * Sanitize a hex color code
 *
 * Returns the color if valid, or null if invalid.
 */
export function sanitizeHexColor(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();

  // Add # if missing
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  if (isValidHexColor(withHash)) {
    return withHash.toLowerCase();
  }

  return null;
}

/**
 * Validate a Twitter handle
 */
export function sanitizeTwitterHandle(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  // Remove @ if present
  let handle = input.trim();
  if (handle.startsWith("@")) {
    handle = handle.slice(1);
  }

  // Twitter handles: 1-15 chars, alphanumeric and underscores only
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(handle)) {
    return null;
  }

  return handle;
}

/**
 * Sanitize a timezone string
 */
export function sanitizeTimezone(input: string): string | null {
  if (!input || typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();

  // Validate against Intl API
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return null;
  }
}
