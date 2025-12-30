import { pgEnum } from "drizzle-orm/pg-core";

// Component status
export const componentStatusEnum = pgEnum("component_status", [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
]);

// Monitor types
export const monitorTypeEnum = pgEnum("monitor_type", [
  "http",
  "tcp",
  "ssl_expiry",
]);

// Monitor result status
export const monitorResultStatusEnum = pgEnum("monitor_result_status", [
  "up",
  "down",
]);

// Incident status
export const incidentStatusEnum = pgEnum("incident_status", [
  "investigating",
  "identified",
  "monitoring",
  "resolved",
]);

// Incident severity
export const incidentSeverityEnum = pgEnum("incident_severity", [
  "minor",
  "major",
  "critical",
]);

// Maintenance status
export const maintenanceStatusEnum = pgEnum("maintenance_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

// Webhook types
export const webhookTypeEnum = pgEnum("webhook_type", [
  "slack",
  "discord",
  "teams",
  "generic",
]);

// Notification delivery type
export const notificationDeliveryTypeEnum = pgEnum("notification_delivery_type", [
  "email",
  "webhook",
]);

// Notification status
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);

// Organization member roles
export const orgRoleEnum = pgEnum("org_role", [
  "owner",
  "admin",
  "member",
]);

// Invite roles (can't invite as owner)
export const inviteRoleEnum = pgEnum("invite_role", [
  "admin",
  "member",
]);

// Type exports
export type ComponentStatus = (typeof componentStatusEnum.enumValues)[number];
export type MonitorType = (typeof monitorTypeEnum.enumValues)[number];
export type MonitorResultStatus = (typeof monitorResultStatusEnum.enumValues)[number];
export type IncidentStatus = (typeof incidentStatusEnum.enumValues)[number];
export type IncidentSeverity = (typeof incidentSeverityEnum.enumValues)[number];
export type MaintenanceStatus = (typeof maintenanceStatusEnum.enumValues)[number];
export type WebhookType = (typeof webhookTypeEnum.enumValues)[number];
export type NotificationDeliveryType = (typeof notificationDeliveryTypeEnum.enumValues)[number];
export type NotificationStatus = (typeof notificationStatusEnum.enumValues)[number];
export type OrgRole = (typeof orgRoleEnum.enumValues)[number];
export type InviteRole = (typeof inviteRoleEnum.enumValues)[number];
