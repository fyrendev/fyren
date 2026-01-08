import Link from "next/link";
import type { Incident } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils";

interface Props {
  incident: Incident;
  slug?: string; // No longer used for routing but kept for backwards compatibility
}

const severityColors: Record<string, string> = {
  minor: "bg-yellow-500/20 text-yellow-400",
  major: "bg-orange-500/20 text-orange-400",
  critical: "bg-red-500/20 text-red-400",
};

const statusColors: Record<string, string> = {
  investigating: "bg-red-500/20 text-red-400",
  identified: "bg-orange-500/20 text-orange-400",
  monitoring: "bg-blue-500/20 text-blue-400",
  resolved: "bg-green-500/20 text-green-400",
};

export function IncidentCard({ incident }: Props) {
  const latestUpdate = incident.updates?.[0] || incident.latestUpdate;

  return (
    <Link href={`/incidents/${incident.id}`}>
      <div className="bg-navy-900 border border-navy-800 rounded-lg p-4 hover:border-navy-700 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium">{incident.title}</h3>
            {latestUpdate && (
              <p className="text-sm text-navy-400 mt-1 line-clamp-2">{latestUpdate.message}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <Badge className={severityColors[incident.severity]}>{incident.severity}</Badge>
            <Badge className={statusColors[incident.status]}>{incident.status}</Badge>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-sm text-navy-500">
          <span>{formatRelativeTime(incident.createdAt)}</span>
          {incident.affectedComponents.length > 0 && (
            <span>Affecting: {incident.affectedComponents.map((c) => c.name).join(", ")}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
