export type StatusIndicator =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance";

export type ComponentStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export type IncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export type IncidentSeverity = "minor" | "major" | "critical";

export type MaintenanceStatus = "scheduled" | "in_progress" | "completed";

export interface Organization {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string | null;
  websiteUrl: string | null;
}

export interface Component {
  id: string;
  name: string;
  description: string | null;
  status: ComponentStatus;
  order: number;
  group?: string | null;
  updatedAt: string;
}

export interface IncidentUpdate {
  id: string;
  status: IncidentStatus;
  message: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  title: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affectedComponents: Array<{ id: string; name: string }>;
  updates: IncidentUpdate[];
  latestUpdate?: IncidentUpdate | null;
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Maintenance {
  id: string;
  title: string;
  description: string | null;
  status: MaintenanceStatus;
  affectedComponents: Array<{ id: string; name: string }>;
  scheduledStartAt: string;
  scheduledEndAt: string;
}

export interface StatusResponse {
  organization: Organization;
  status: {
    indicator: StatusIndicator;
    description: string;
  };
  components: Component[];
  activeIncidents: Incident[];
  scheduledMaintenance: Maintenance[];
  updatedAt: string;
}

export interface UptimeData {
  day: number;
  week: number;
  month: number;
  quarter: number;
}

export interface ComponentUptime {
  id: string;
  name: string;
  uptime: UptimeData;
}

export interface UptimeResponse {
  components: ComponentUptime[];
  overall: UptimeData;
}

export interface UptimeHistory {
  date: string;
  uptime: number;
  incidents: number;
  status: string;
}

export interface UptimeHistoryResponse {
  component: {
    id: string;
    name: string;
  };
  history: UptimeHistory[];
}

export interface IncidentsResponse {
  incidents: Incident[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface IncidentResponse {
  incident: Incident;
}

export interface MaintenanceResponse {
  maintenance: Maintenance[];
}
