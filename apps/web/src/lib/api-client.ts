import type { WebhookType } from "@fyrendev/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiClient<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include", // Send cookies for session auth
    headers: {
      "Content-Type": "application/json",
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

export interface Subscriber {
  id: string;
  email: string;
  verified: boolean;
  createdAt: string;
  unsubscribedAt: string | null;
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

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  websiteUrl: string | null;
  customDomain: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  total: number;
  limit: number;
  offset: number;
}

// Typed API methods
export const api = {
  // Components
  getComponents: () =>
    apiClient<{ components: Component[] }>("/api/v1/admin/components"),
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
  getMonitors: () =>
    apiClient<{ monitors: Monitor[] }>("/api/v1/admin/monitors"),
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
  getIncident: (id: string) =>
    apiClient<{ incident: Incident }>(`/api/v1/admin/incidents/${id}`),
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
  addIncidentUpdate: (
    id: string,
    data: { status: string; message: string }
  ) =>
    apiClient<{ update: IncidentUpdate }>(
      `/api/v1/admin/incidents/${id}/updates`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),
  resolveIncident: (id: string, data?: { message?: string }) =>
    apiClient<{ update: IncidentUpdate }>(
      `/api/v1/admin/incidents/${id}/resolve`,
      {
        method: "PATCH",
        body: JSON.stringify(data || {}),
      }
    ),

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
    apiClient<{ maintenance: Maintenance }>(
      `/api/v1/admin/maintenance/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    ),
  startMaintenance: (id: string) =>
    apiClient<{ maintenance: Maintenance }>(
      `/api/v1/admin/maintenance/${id}/start`,
      {
        method: "PATCH",
      }
    ),
  completeMaintenance: (id: string) =>
    apiClient<{ maintenance: Maintenance }>(
      `/api/v1/admin/maintenance/${id}/complete`,
      {
        method: "PATCH",
      }
    ),
  cancelMaintenance: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/maintenance/${id}`, {
      method: "DELETE",
    }),

  // Subscribers
  getSubscribers: (params?: string) =>
    apiClient<{ subscribers: Subscriber[]; pagination: Pagination }>(
      `/api/v1/admin/subscribers${params ? `?${params}` : ""}`
    ),
  deleteSubscriber: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/subscribers/${id}`, {
      method: "DELETE",
    }),

  // Webhooks
  getWebhooks: () =>
    apiClient<{ webhooks: WebhookEndpoint[] }>("/api/v1/admin/webhooks"),
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
    apiClient<{ webhook: WebhookEndpoint }>(
      `/api/v1/admin/webhooks/${id}/toggle`,
      {
        method: "PATCH",
      }
    ),
  testWebhook: (id: string) =>
    apiClient<{ success: boolean; error?: string }>(
      `/api/v1/admin/webhooks/${id}/test`,
      {
        method: "POST",
      }
    ),

  // API Keys
  getApiKeys: () =>
    apiClient<{ apiKeys: ApiKey[] }>("/api/v1/admin/api-keys"),
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
  getMembers: () =>
    apiClient<{ members: Member[] }>("/api/v1/admin/members"),
  updateMember: (id: string, data: { role: string }) =>
    apiClient<{ member: Member }>(`/api/v1/admin/members/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  removeMember: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/members/${id}`, {
      method: "DELETE",
    }),
  getInvites: () =>
    apiClient<{ invites: Invite[] }>("/api/v1/admin/invites"),
  createInvite: (data: { email: string; role: string }) =>
    apiClient<{ invite: Invite }>("/api/v1/admin/invites", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteInvite: (id: string) =>
    apiClient<{ success: boolean }>(`/api/v1/admin/invites/${id}`, {
      method: "DELETE",
    }),

  // Organization
  getOrganization: () =>
    apiClient<{ organization: Organization }>("/api/v1/admin/organization"),
  updateOrganization: (data: Partial<Organization>) =>
    apiClient<{ organization: Organization }>("/api/v1/admin/organization", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
