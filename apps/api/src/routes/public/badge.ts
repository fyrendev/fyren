import { Hono } from "hono";
import { db, eq, components } from "@fyrendev/db";
import type { ComponentStatus } from "@fyrendev/db";
import { errorResponse } from "../../lib/errors";
import { getOrganization } from "../../lib/organization";
import { widgetCorsHeaders, cacheHeaders } from "../../middleware/security";
import { badgeRateLimit } from "../../middleware/rateLimit";
import { env } from "../../env/api";

export const badgeRoutes = new Hono();

// Status to color mapping (matches component_status enum)
const STATUS_COLORS = {
  operational: { color: "#22c55e", label: "Operational" },
  degraded: { color: "#f59e0b", label: "Degraded" },
  partial_outage: { color: "#f97316", label: "Partial Outage" },
  major_outage: { color: "#ef4444", label: "Major Outage" },
  maintenance: { color: "#3b82f6", label: "Maintenance" },
} as const;

// Calculate overall status from component statuses
function calculateOverallStatus(statuses: ComponentStatus[]): {
  color: string;
  label: string;
  indicator: string;
} {
  // Priority order: major_outage > partial_outage > degraded > maintenance > operational
  if (statuses.some((s) => s === "major_outage")) {
    return { ...STATUS_COLORS.major_outage, indicator: "critical" };
  }
  if (statuses.some((s) => s === "partial_outage")) {
    return { ...STATUS_COLORS.partial_outage, indicator: "major" };
  }
  if (statuses.some((s) => s === "degraded")) {
    return { ...STATUS_COLORS.degraded, indicator: "minor" };
  }
  if (statuses.some((s) => s === "maintenance")) {
    return { ...STATUS_COLORS.maintenance, indicator: "maintenance" };
  }
  return { ...STATUS_COLORS.operational, indicator: "none" };
}

// Generate shields.io-compatible SVG badge
function generateBadgeSvg(
  label: string,
  status: string,
  color: string,
  style: "flat" | "flat-square" | "plastic" = "flat"
): string {
  const labelWidth = label.length * 6.5 + 10;
  const statusWidth = status.length * 6.5 + 10;
  const totalWidth = labelWidth + statusWidth;

  const radius = style === "flat-square" ? 0 : 3;
  const gradient = style === "plastic";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${status}">
  <title>${label}: ${status}</title>
  ${
    gradient
      ? `<linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>`
      : `<linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>`
  }
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="${radius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11" text-rendering="geometricPrecision">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelWidth / 2}" y="14">${escapeXml(label)}</text>
    <text aria-hidden="true" x="${labelWidth + statusWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(status)}</text>
    <text x="${labelWidth + statusWidth / 2}" y="14">${escapeXml(status)}</text>
  </g>
</svg>`;
}

// Escape XML entities
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Apply rate limiting and CORS
badgeRoutes.use("*", badgeRateLimit);
badgeRoutes.use("*", widgetCorsHeaders());
badgeRoutes.use("*", cacheHeaders(60)); // Cache for 60 seconds

// GET /api/v1/status/badge.svg - SVG status badge
badgeRoutes.get("/badge.svg", async (c) => {
  try {
    const style = (c.req.query("style") as "flat" | "flat-square" | "plastic") || "flat";
    const label = c.req.query("label") || "status";

    // Get all public components
    const publicComps = await db
      .select({ status: components.status })
      .from(components)
      .where(eq(components.isPublic, true));

    // Calculate overall status
    const statuses = publicComps.map((c) => c.status as ComponentStatus);
    const overall = calculateOverallStatus(statuses);

    const svg = generateBadgeSvg(label, overall.label, overall.color, style);

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch {
    // Return a generic error badge
    const svg = generateBadgeSvg("status", "unknown", "#6b7280", "flat");
    return new Response(svg, {
      status: 404,
      headers: {
        "Content-Type": "image/svg+xml",
      },
    });
  }
});

// GET /api/v1/status/badge.json - JSON badge data (for custom implementations)
badgeRoutes.get("/badge.json", async (c) => {
  try {
    const org = await getOrganization();

    // Get all public components
    const publicComps = await db
      .select({ status: components.status })
      .from(components)
      .where(eq(components.isPublic, true));

    // Calculate overall status
    const statuses = publicComps.map((c) => c.status as ComponentStatus);
    const overall = calculateOverallStatus(statuses);

    return c.json({
      schemaVersion: 1,
      label: "status",
      message: overall.label,
      color: overall.color.replace("#", ""),
      indicator: overall.indicator,
      page: {
        name: org.name,
        url: env.APP_URL,
      },
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// GET /api/v1/status/badge - Redirect to SVG
badgeRoutes.get("/badge", async (c) => {
  const query = c.req.query();
  const queryString = new URLSearchParams(query as Record<string, string>).toString();
  return c.redirect(`/api/v1/status/badge.svg${queryString ? `?${queryString}` : ""}`);
});
