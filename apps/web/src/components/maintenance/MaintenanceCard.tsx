import type { Maintenance } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { Wrench } from "lucide-react";

interface Props {
  maintenance: Maintenance;
}

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
};

export function MaintenanceCard({ maintenance }: Props) {
  return (
    <div className="theme-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Wrench className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-medium">{maintenance.title}</h3>
            {maintenance.description && (
              <p className="text-sm theme-muted mt-1">{maintenance.description}</p>
            )}
          </div>
        </div>
        <Badge className={statusColors[maintenance.status]}>
          {maintenance.status.replace("_", " ")}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-sm theme-muted">
        <div>
          <span className="opacity-70">Starts: </span>
          {formatDateTime(maintenance.scheduledStartAt)}
        </div>
        <div>
          <span className="opacity-70">Ends: </span>
          {formatDateTime(maintenance.scheduledEndAt)}
        </div>
      </div>

      {maintenance.affectedComponents.length > 0 && (
        <div className="mt-3 text-sm theme-muted opacity-70">
          Affecting: {maintenance.affectedComponents.map((c) => c.name).join(", ")}
        </div>
      )}
    </div>
  );
}
