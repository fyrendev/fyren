import type { Component, UptimeData } from "@/lib/types";
import { StatusDot } from "./StatusDot";
import { UptimeBar } from "./UptimeBar";

interface Props {
  component: Component;
  uptime?: UptimeData;
}

const statusLabels: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded Performance",
  degraded_performance: "Degraded Performance",
  partial_outage: "Partial Outage",
  major_outage: "Major Outage",
  maintenance: "Under Maintenance",
  under_maintenance: "Under Maintenance",
};

export function ComponentRow({ component, uptime }: Props) {
  return (
    <div
      className="px-4 py-4 last:border-b-0"
      style={{ borderBottom: "1px solid var(--card-border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusDot status={component.status} />
          <span className="font-medium">{component.name}</span>
        </div>
        <div className="flex items-center gap-4">
          {uptime && <span className="text-sm theme-muted">{uptime.month.toFixed(2)}%</span>}
          <span className="text-sm theme-muted">
            {statusLabels[component.status] || component.status}
          </span>
        </div>
      </div>

      {/* Uptime bar - loads via client component */}
      <div className="mt-3">
        <UptimeBar componentId={component.id} />
      </div>
    </div>
  );
}
