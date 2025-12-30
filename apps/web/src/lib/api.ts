import type {
  StatusResponse,
  UptimeResponse,
  UptimeHistoryResponse,
  IncidentsResponse,
  IncidentResponse,
  MaintenanceResponse,
} from "./types";

const API_URL = process.env.API_URL || "http://localhost:3000";

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    next: { revalidate: 60 }, // ISR: revalidate every 60 seconds
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}

export async function getStatus(slug: string): Promise<StatusResponse> {
  return fetchAPI<StatusResponse>(`/api/v1/status/${slug}`);
}

export async function getUptime(slug: string): Promise<UptimeResponse> {
  return fetchAPI<UptimeResponse>(`/api/v1/status/${slug}/uptime`, {
    next: { revalidate: 300 }, // 5 minutes for uptime
  });
}

export async function getUptimeHistory(
  slug: string,
  componentId: string,
  days = 90
): Promise<UptimeHistoryResponse> {
  return fetchAPI<UptimeHistoryResponse>(
    `/api/v1/status/${slug}/uptime/${componentId}/history?days=${days}`
  );
}

export async function getIncidents(
  slug: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<IncidentsResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));

  const queryString = params.toString();
  return fetchAPI<IncidentsResponse>(
    `/api/v1/status/${slug}/incidents${queryString ? `?${queryString}` : ""}`
  );
}

export async function getIncident(
  slug: string,
  incidentId: string
): Promise<IncidentResponse> {
  return fetchAPI<IncidentResponse>(
    `/api/v1/status/${slug}/incidents/${incidentId}`
  );
}

export async function getMaintenance(
  slug: string
): Promise<MaintenanceResponse> {
  return fetchAPI<MaintenanceResponse>(`/api/v1/status/${slug}/maintenance`);
}
