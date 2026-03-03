import type {
  StatusResponse,
  UptimeResponse,
  UptimeHistoryResponse,
  IncidentsResponse,
  IncidentResponse,
  MaintenanceResponse,
} from "./types";
import { request } from "./request";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await request(path, {
    ...options,
    next: { revalidate: 60 }, // ISR: revalidate every 60 seconds
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function getStatus(): Promise<StatusResponse> {
  return fetchAPI<StatusResponse>(`/api/v1/status`);
}

export async function getUptime(): Promise<UptimeResponse> {
  return fetchAPI<UptimeResponse>(`/api/v1/status/uptime`, {
    next: { revalidate: 300 }, // 5 minutes for uptime
  });
}

export async function getUptimeHistory(
  componentId: string,
  days = 90
): Promise<UptimeHistoryResponse> {
  return fetchAPI<UptimeHistoryResponse>(
    `/api/v1/status/uptime/${componentId}/history?days=${days}`
  );
}

export async function getIncidents(options?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<IncidentsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const queryString = params.toString();
  return fetchAPI<IncidentsResponse>(
    `/api/v1/status/incidents${queryString ? `?${queryString}` : ""}`
  );
}

export async function getIncident(incidentId: string): Promise<IncidentResponse> {
  return fetchAPI<IncidentResponse>(`/api/v1/status/incidents/${incidentId}`);
}

export async function getMaintenance(): Promise<MaintenanceResponse> {
  return fetchAPI<MaintenanceResponse>(`/api/v1/status/maintenance`);
}

// Setup and default org helpers

export interface SetupStatusResponse {
  needsSetup: boolean;
  hasUsers: boolean;
  hasOrganization: boolean;
}

export interface DefaultOrgResponse {
  organization: {
    name: string;
    slug: string;
    logoUrl: string | null;
    brandColor: string | null;
    accentColor: string | null;
    backgroundColor: string | null;
    textColor: string | null;
  };
}

export async function getSetupStatus(): Promise<SetupStatusResponse> {
  return fetchAPI<SetupStatusResponse>("/api/v1/setup/status", {
    next: { revalidate: 0 }, // Always fresh for setup status
  });
}

export async function getDefaultOrg(): Promise<DefaultOrgResponse> {
  return fetchAPI<DefaultOrgResponse>("/api/v1/org/default");
}
