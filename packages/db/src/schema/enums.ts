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
]);

// Webhook types
export const webhookTypeEnum = pgEnum("webhook_type", [
  "slack",
  "discord",
  "teams",
  "generic",
]);

// Notification types
export const notificationTypeEnum = pgEnum("notification_type", [
  "incident",
  "maintenance",
  "status_change",
]);

// Notification channels
export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "slack",
  "discord",
  "webhook",
]);

// Notification status
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
]);

// Type exports
export type ComponentStatus = (typeof componentStatusEnum.enumValues)[number];
export type MonitorType = (typeof monitorTypeEnum.enumValues)[number];
export type MonitorResultStatus = (typeof monitorResultStatusEnum.enumValues)[number];
export type IncidentStatus = (typeof incidentStatusEnum.enumValues)[number];
export type IncidentSeverity = (typeof incidentSeverityEnum.enumValues)[number];
export type MaintenanceStatus = (typeof maintenanceStatusEnum.enumValues)[number];
export type WebhookType = (typeof webhookTypeEnum.enumValues)[number];
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
export type NotificationChannel = (typeof notificationChannelEnum.enumValues)[number];
export type NotificationStatus = (typeof notificationStatusEnum.enumValues)[number];
