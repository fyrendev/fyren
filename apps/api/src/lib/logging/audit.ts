/**
 * Audit Logging Utility
 *
 * Provides structured audit logging for admin operations.
 */

import { logger } from "./index";

/**
 * Predefined audit actions
 */
export const AuditAction = {
  // Organization
  ORG_CREATE: "org.create",
  ORG_UPDATE: "org.update",
  ORG_DELETE: "org.delete",

  // Component
  COMPONENT_CREATE: "component.create",
  COMPONENT_UPDATE: "component.update",
  COMPONENT_DELETE: "component.delete",
  COMPONENT_STATUS_CHANGE: "component.status_change",

  // Incident
  INCIDENT_CREATE: "incident.create",
  INCIDENT_UPDATE: "incident.update",
  INCIDENT_DELETE: "incident.delete",
  INCIDENT_RESOLVE: "incident.resolve",
  INCIDENT_UPDATE_ADD: "incident.update_add",

  // Maintenance
  MAINTENANCE_CREATE: "maintenance.create",
  MAINTENANCE_UPDATE: "maintenance.update",
  MAINTENANCE_DELETE: "maintenance.delete",
  MAINTENANCE_START: "maintenance.start",
  MAINTENANCE_COMPLETE: "maintenance.complete",

  // Monitor
  MONITOR_CREATE: "monitor.create",
  MONITOR_UPDATE: "monitor.update",
  MONITOR_DELETE: "monitor.delete",

  // Subscriber
  SUBSCRIBER_CREATE: "subscriber.create",
  SUBSCRIBER_DELETE: "subscriber.delete",

  // Webhook
  WEBHOOK_CREATE: "webhook.create",
  WEBHOOK_UPDATE: "webhook.update",
  WEBHOOK_DELETE: "webhook.delete",

  // API Key
  API_KEY_CREATE: "api_key.create",
  API_KEY_DELETE: "api_key.delete",

  // User/Auth
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",
  USER_INVITE: "user.invite",
  USER_REMOVE: "user.remove",
  USER_ROLE_CHANGE: "user.role_change",

  // System Settings
  SETTINGS_UPDATE: "settings.update",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Entity types for audit logging
 */
export const EntityType = {
  ORGANIZATION: "organization",
  COMPONENT: "component",
  INCIDENT: "incident",
  INCIDENT_UPDATE: "incident_update",
  MAINTENANCE: "maintenance",
  MONITOR: "monitor",
  SUBSCRIBER: "subscriber",
  WEBHOOK: "webhook",
  API_KEY: "api_key",
  USER: "user",
  SETTINGS: "settings",
} as const;

export type EntityTypeValue = (typeof EntityType)[keyof typeof EntityType];

/**
 * Options for audit logging
 */
export interface AuditLogOptions {
  action: AuditActionType;
  entityType: EntityTypeValue;
  entityId: string;
  userId?: string;
  organizationId?: string;
  requestId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Log an audit event
 */
export function audit(options: AuditLogOptions): void {
  const { action, entityType, entityId, userId, organizationId, requestId, changes, metadata } =
    options;

  logger.audit(action, entityType, entityId, {
    userId,
    organizationId,
    requestId,
    changes,
    ...metadata,
  });
}

/**
 * Create an audit logger bound to a specific request context
 */
export function createAuditLogger(context: {
  userId?: string;
  organizationId?: string;
  requestId?: string;
}) {
  return {
    log(options: Omit<AuditLogOptions, "userId" | "organizationId" | "requestId">) {
      audit({
        ...options,
        userId: context.userId,
        organizationId: context.organizationId,
        requestId: context.requestId,
      });
    },

    orgCreated(orgId: string, metadata?: Record<string, unknown>) {
      this.log({
        action: AuditAction.ORG_CREATE,
        entityType: EntityType.ORGANIZATION,
        entityId: orgId,
        metadata,
      });
    },

    orgUpdated(orgId: string, changes?: Record<string, unknown>) {
      this.log({
        action: AuditAction.ORG_UPDATE,
        entityType: EntityType.ORGANIZATION,
        entityId: orgId,
        changes,
      });
    },

    componentCreated(componentId: string, metadata?: Record<string, unknown>) {
      this.log({
        action: AuditAction.COMPONENT_CREATE,
        entityType: EntityType.COMPONENT,
        entityId: componentId,
        metadata,
      });
    },

    componentUpdated(componentId: string, changes?: Record<string, unknown>) {
      this.log({
        action: AuditAction.COMPONENT_UPDATE,
        entityType: EntityType.COMPONENT,
        entityId: componentId,
        changes,
      });
    },

    componentDeleted(componentId: string) {
      this.log({
        action: AuditAction.COMPONENT_DELETE,
        entityType: EntityType.COMPONENT,
        entityId: componentId,
      });
    },

    componentStatusChanged(componentId: string, changes: { from: string; to: string }) {
      this.log({
        action: AuditAction.COMPONENT_STATUS_CHANGE,
        entityType: EntityType.COMPONENT,
        entityId: componentId,
        changes,
      });
    },

    incidentCreated(incidentId: string, metadata?: Record<string, unknown>) {
      this.log({
        action: AuditAction.INCIDENT_CREATE,
        entityType: EntityType.INCIDENT,
        entityId: incidentId,
        metadata,
      });
    },

    incidentUpdated(incidentId: string, changes?: Record<string, unknown>) {
      this.log({
        action: AuditAction.INCIDENT_UPDATE,
        entityType: EntityType.INCIDENT,
        entityId: incidentId,
        changes,
      });
    },

    incidentResolved(incidentId: string, metadata?: Record<string, unknown>) {
      this.log({
        action: AuditAction.INCIDENT_RESOLVE,
        entityType: EntityType.INCIDENT,
        entityId: incidentId,
        metadata,
      });
    },

    incidentDeleted(incidentId: string) {
      this.log({
        action: AuditAction.INCIDENT_DELETE,
        entityType: EntityType.INCIDENT,
        entityId: incidentId,
      });
    },

    incidentUpdateAdded(updateId: string, incidentId: string, metadata?: Record<string, unknown>) {
      this.log({
        action: AuditAction.INCIDENT_UPDATE_ADD,
        entityType: EntityType.INCIDENT_UPDATE,
        entityId: updateId,
        metadata: { incidentId, ...metadata },
      });
    },

    settingsUpdated(scope: string, setting: string, changes?: Record<string, unknown>) {
      this.log({
        action: AuditAction.SETTINGS_UPDATE,
        entityType: EntityType.SETTINGS,
        entityId: `${scope}:${setting}`,
        changes,
      });
    },
  };
}
