// Fyren Shared Types and Utilities
// Add shared types, validation schemas, and utilities here

export const VERSION = "0.0.1";

// Component status enum
export const ComponentStatus = {
  OPERATIONAL: "operational",
  DEGRADED: "degraded",
  PARTIAL_OUTAGE: "partial_outage",
  MAJOR_OUTAGE: "major_outage",
  MAINTENANCE: "maintenance",
} as const;

export type ComponentStatus =
  (typeof ComponentStatus)[keyof typeof ComponentStatus];

// Incident status enum
export const IncidentStatus = {
  INVESTIGATING: "investigating",
  IDENTIFIED: "identified",
  MONITORING: "monitoring",
  RESOLVED: "resolved",
} as const;

export type IncidentStatus =
  (typeof IncidentStatus)[keyof typeof IncidentStatus];

// Incident severity enum
export const IncidentSeverity = {
  MINOR: "minor",
  MAJOR: "major",
  CRITICAL: "critical",
} as const;

export type IncidentSeverity =
  (typeof IncidentSeverity)[keyof typeof IncidentSeverity];

// Webhook type enum
export const WebhookType = {
  SLACK: "slack",
  DISCORD: "discord",
  TEAMS: "teams",
  GENERIC: "generic",
} as const;

export type WebhookType = (typeof WebhookType)[keyof typeof WebhookType];
