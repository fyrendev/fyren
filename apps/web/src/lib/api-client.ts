import type { WebhookType } from "@fyrendev/shared";
import { getCurrentOrgId } from "@/contexts/OrganizationContext";

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const orgId = getCurrentOrgId();

  const res = await fetch(`${path}`, {
    ...options,
    credentials: "include", // Send cookies for session auth
    headers: {
      "Content-Type": "application/json",
      ...(orgId ? { "X-Organization-Id": orgId } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.error?.message || error.message || "Request failed");
  }

  return res.json();
}

// Types
export interface Component {
  id: string;
  name: string;
  description: string | null;
  status: string;
  order: number;
  group: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Monitor {
  id: string;
  componentId: string;
  component?: Component;
  type: "http" | "tcp" | "ssl_expiry";
  url: string;
  intervalSeconds: number;
  timeoutMs: number;
  expectedStatusCode: number | null;
  failureThreshold: number;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastStatus: "up" | "down" | null;
  createdAt: string;
  updatedAt: string;
}

export interface Incident {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical";
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  affectedComponents?: Array<{
    componentId: string;
    component?: { id: string; name: string };
  }>;
  updates?: IncidentUpdate[];
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  status: string;
  message: string;
  createdAt: string;
}

export interface Maintenance {
  id: string;
  title: string;
  description: string | null;
  status: "scheduled" | "in_progress" | "completed";
  scheduledStartAt: string;
  scheduledEndAt: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  createdAt: string;
  updatedAt: string;
  affectedComponents?: Array<{
    componentId: string;
    component?: { id: string; name: string };
  }>;
}

export interface SubscriberGroup {
  id: string;
  name: string;
  description: string | null;
  componentIds: string[] | null;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Subscriber {
  id: string;
  email: string;
  verified: boolean;
  verifiedAt: string | null;
  groupId: string | null;
  group: { id: string; name: string } | null;
  componentIds: string[] | null;
  notifyOnIncident: boolean;
  notifyOnMaintenance: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  type: WebhookType;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Member {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  role: "owner" | "admin" | "member";
  createdAt: string;
}

export interface Invite {
  id: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
  createdAt: string;
}

export type EmailProvider = "console" | "smtp" | "sendgrid" | "ses";

export interface SMTPConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  secure?: boolean;
}

export interface SendGridConfig {
  apiKey: string;
}

export interface SESConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type EmailConfig = SMTPConfig | SendGridConfig | SESConfig;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  logoLightUrl: string | null;
  faviconUrl: string | null;
  brandColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  customCss: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  twitterHandle: string | null;
  supportUrl: string | null;
  timezone: string;
  // Email configuration
  emailProvider: EmailProvider;
  emailFromAddress: string | null;
  emailConfigured: boolean; // True if credentials are set (never exposes actual credentials)
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

// Logging Configuration Types
export type LogProvider = "console" | "loki" | "otlp";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LokiConfigInput {
  username?: string;
  password?: string;
  tenantId?: string;
}

export interface OtlpConfigInput {
  headers?: Record<string, string>;
}

export interface LoggingConfig {
  logProvider: LogProvider;
  logLevel: LogLevel;
  logServiceName: string;
  lokiUrl: string | null;
  lokiConfigured: boolean;
  otlpEndpoint: string | null;
  otlpConfigured: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface LoggingConfigInput {
  logProvider: LogProvider;
  logLevel: LogLevel;
  logServiceName?: string;
  lokiUrl?: string | null;
  lokiConfig?: LokiConfigInput | null;
  otlpEndpoint?: string | null;
  otlpConfig?: OtlpConfigInput | null;
}

// Typed API methods
export const api = {
  // Components
  getComponents: () => apiClient<{ components: Component[] }>("/api/v1/admin/components"),
  createComponent: (data: Partial<Component>) =>
    apiClient<{ component: Component }>("/api/v1/admin/components", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateComponent: (id: string, data: Partial<Component>) =>
    apiClient<{ component: Component }>(`/api/v1/admin/components/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteComponent: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/components/${id}`, {
      method: "DELETE",
    }),

  // Monitors
  getMonitors: () => apiClient<{ monitors: Monitor[] }>("/api/v1/admin/monitors"),
  createMonitor: (data: Partial<Monitor>) =>
    apiClient<{ monitor: Monitor }>("/api/v1/admin/monitors", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMonitor: (id: string, data: Partial<Monitor>) =>
    apiClient<{ monitor: Monitor }>(`/api/v1/admin/monitors/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteMonitor: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/monitors/${id}`, {
      method: "DELETE",
    }),
  toggleMonitor: (id: string) =>
    apiClient<{ monitor: Monitor }>(`/api/v1/admin/monitors/${id}/toggle`, {
      method: "PATCH",
    }),

  // Incidents
  getIncidents: (params?: string) =>
    apiClient<{ incidents: Incident[]; pagination: Pagination }>(
      `/api/v1/admin/incidents${params ? `?${params}` : ""}`
    ),
  getIncident: (id: string) => apiClient<{ incident: Incident }>(`/api/v1/admin/incidents/${id}`),
  createIncident: (data: {
    title: string;
    severity: string;
    message: string;
    componentIds?: string[];
  }) =>
    apiClient<{ incident: Incident }>("/api/v1/admin/incidents", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateIncident: (id: string, data: Partial<Incident>) =>
    apiClient<{ incident: Incident }>(`/api/v1/admin/incidents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  addIncidentUpdate: (id: string, data: { status: string; message: string }) =>
    apiClient<{ update: IncidentUpdate }>(`/api/v1/admin/incidents/${id}/updates`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resolveIncident: (id: string, data?: { message?: string }) =>
    apiClient<{ update: IncidentUpdate }>(`/api/v1/admin/incidents/${id}/resolve`, {
      method: "PATCH",
      body: JSON.stringify(data || {}),
    }),

  // Maintenance
  getMaintenances: (params?: string) =>
    apiClient<{ maintenances: Maintenance[]; pagination: Pagination }>(
      `/api/v1/admin/maintenance${params ? `?${params}` : ""}`
    ),
  getMaintenance: (id: string) =>
    apiClient<{ maintenance: Maintenance }>(`/api/v1/admin/maintenance/${id}`),
  createMaintenance: (data: {
    title: string;
    description?: string;
    scheduledStartAt: string;
    scheduledEndAt: string;
    componentIds?: string[];
  }) =>
    apiClient<{ maintenance: Maintenance }>("/api/v1/admin/maintenance", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateMaintenance: (id: string, data: Partial<Maintenance>) =>
    apiClient<{ maintenance: Maintenance }>(`/api/v1/admin/maintenance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  startMaintenance: (id: string) =>
    apiClient<{ maintenance: Maintenance }>(`/api/v1/admin/maintenance/${id}/start`, {
      method: "PATCH",
    }),
  completeMaintenance: (id: string) =>
    apiClient<{ maintenance: Maintenance }>(`/api/v1/admin/maintenance/${id}/complete`, {
      method: "PATCH",
    }),
  cancelMaintenance: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/maintenance/${id}`, {
      method: "DELETE",
    }),

  // Subscribers
  getSubscribers: (params?: string) =>
    apiClient<{ subscribers: Subscriber[]; pagination: Pagination }>(
      `/api/v1/admin/subscribers${params ? `?${params}` : ""}`
    ),
  getSubscriber: (id: string) =>
    apiClient<{ subscriber: Subscriber }>(`/api/v1/admin/subscribers/${id}`),
  createSubscriber: (data: {
    email: string;
    groupId?: string | null;
    componentIds?: string[] | null;
    notifyOnIncident?: boolean;
    notifyOnMaintenance?: boolean;
  }) =>
    apiClient<{ subscriber: Subscriber }>("/api/v1/admin/subscribers", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSubscriber: (
    id: string,
    data: {
      email?: string;
      groupId?: string | null;
      componentIds?: string[] | null;
      notifyOnIncident?: boolean;
      notifyOnMaintenance?: boolean;
    }
  ) =>
    apiClient<{ subscriber: Subscriber }>(`/api/v1/admin/subscribers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSubscriber: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/subscribers/${id}`, {
      method: "DELETE",
    }),

  // Subscriber Groups
  getSubscriberGroups: () =>
    apiClient<{ subscriberGroups: SubscriberGroup[] }>("/api/v1/admin/subscriber-groups"),
  getSubscriberGroup: (id: string) =>
    apiClient<{ subscriberGroup: SubscriberGroup }>(`/api/v1/admin/subscriber-groups/${id}`),
  createSubscriberGroup: (data: {
    name: string;
    description?: string | null;
    componentIds?: string[] | null;
  }) =>
    apiClient<{ subscriberGroup: SubscriberGroup }>("/api/v1/admin/subscriber-groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateSubscriberGroup: (
    id: string,
    data: {
      name?: string;
      description?: string | null;
      componentIds?: string[] | null;
    }
  ) =>
    apiClient<{ subscriberGroup: SubscriberGroup }>(`/api/v1/admin/subscriber-groups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteSubscriberGroup: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/subscriber-groups/${id}`, {
      method: "DELETE",
    }),
  getSubscriberGroupMembers: (id: string) =>
    apiClient<{ subscribers: Subscriber[] }>(`/api/v1/admin/subscriber-groups/${id}/members`),

  // Webhooks
  getWebhooks: () => apiClient<{ webhooks: WebhookEndpoint[] }>("/api/v1/admin/webhooks"),
  createWebhook: (data: Partial<WebhookEndpoint>) =>
    apiClient<{ webhook: WebhookEndpoint }>("/api/v1/admin/webhooks", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateWebhook: (id: string, data: Partial<WebhookEndpoint>) =>
    apiClient<{ webhook: WebhookEndpoint }>(`/api/v1/admin/webhooks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteWebhook: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/webhooks/${id}`, {
      method: "DELETE",
    }),
  toggleWebhook: (id: string) =>
    apiClient<{ webhook: WebhookEndpoint }>(`/api/v1/admin/webhooks/${id}/toggle`, {
      method: "PATCH",
    }),
  testWebhook: (id: string) =>
    apiClient<{ success: boolean; error?: string }>(`/api/v1/admin/webhooks/${id}/test`, {
      method: "POST",
    }),

  // API Keys
  getApiKeys: () => apiClient<{ apiKeys: ApiKey[] }>("/api/v1/admin/api-keys"),
  createApiKey: (data: { name: string; expiresAt?: string }) =>
    apiClient<{ apiKey: ApiKey; plainKey: string }>("/api/v1/admin/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteApiKey: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/api-keys/${id}`, {
      method: "DELETE",
    }),

  // Team
  getMembers: () => {
    const orgId = getCurrentOrgId();
    return apiClient<{ members: Member[] }>(`/api/v1/admin/organizations/${orgId}/members`);
  },
  updateMember: (id: string, data: { role: string }) => {
    const orgId = getCurrentOrgId();
    return apiClient<{ member: Member }>(`/api/v1/admin/organizations/${orgId}/members/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  removeMember: (id: string) => {
    const orgId = getCurrentOrgId();
    return apiClient<{ success: boolean }>(`/api/v1/admin/organizations/${orgId}/members/${id}`, {
      method: "DELETE",
    });
  },
  getInvites: () => {
    const orgId = getCurrentOrgId();
    return apiClient<{ invites: Invite[] }>(`/api/v1/admin/organizations/${orgId}/invites`);
  },
  createInvite: (data: { email: string; role: string }) => {
    const orgId = getCurrentOrgId();
    return apiClient<{ invite: Invite }>(`/api/v1/admin/organizations/${orgId}/invites`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  deleteInvite: (id: string) => {
    const orgId = getCurrentOrgId();
    return apiClient<{ success: boolean }>(`/api/v1/admin/organizations/${orgId}/invites/${id}`, {
      method: "DELETE",
    });
  },

  // Organization
  getOrganization: () => {
    const orgId = getCurrentOrgId();
    return apiClient<{ organization: Organization }>(`/api/v1/admin/organizations/${orgId}`);
  },
  updateOrganization: (data: Partial<Organization> & { emailConfig?: EmailConfig | null }) => {
    const orgId = getCurrentOrgId();
    return apiClient<{ organization: Organization }>(`/api/v1/admin/organizations/${orgId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  testEmail: () => {
    const orgId = getCurrentOrgId();
    return apiClient<{ success: boolean; message: string }>(
      `/api/v1/admin/organizations/${orgId}/test-email`,
      {
        method: "POST",
      }
    );
  },

  // System Settings
  getLoggingConfig: () =>
    apiClient<{
      config: LoggingConfig;
      currentSource: "env" | "database";
      currentProvider: string;
    }>("/api/v1/admin/system/logging"),
  updateLoggingConfig: (data: LoggingConfigInput) =>
    apiClient<{ config: LoggingConfig; message: string }>("/api/v1/admin/system/logging", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  testLoggingConfig: () =>
    apiClient<{ success: boolean; message: string }>("/api/v1/admin/system/logging/test", {
      method: "POST",
    }),
  reloadLoggingConfig: () =>
    apiClient<{ success: boolean; message: string; provider: string; source: string }>(
      "/api/v1/admin/system/logging/reload",
      {
        method: "POST",
      }
    ),
  resetLoggingConfig: () =>
    apiClient<{ success: boolean; message: string; provider: string; source: string }>(
      "/api/v1/admin/system/logging/reset",
      {
        method: "POST",
      }
    ),
};
