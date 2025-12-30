import type { IncidentUpdate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

interface Props {
  updates: IncidentUpdate[];
}

const statusColors: Record<string, string> = {
  investigating: "bg-red-500",
  identified: "bg-orange-500",
  monitoring: "bg-blue-500",
  resolved: "bg-green-500",
};

const statusBadgeColors: Record<string, string> = {
  investigating: "bg-red-500/20 text-red-400",
  identified: "bg-orange-500/20 text-orange-400",
  monitoring: "bg-blue-500/20 text-blue-400",
  resolved: "bg-green-500/20 text-green-400",
};

export function IncidentTimeline({ updates }: Props) {
  return (
    <div className="space-y-6">
      {updates.map((update, index) => (
        <div key={update.id} className="relative pl-6">
          {/* Timeline line */}
          {index < updates.length - 1 && (
            <div className="absolute left-[7px] top-6 bottom-0 w-0.5 bg-navy-700" />
          )}

          {/* Timeline dot */}
          <div
            className={`absolute left-0 top-1.5 w-4 h-4 rounded-full ${statusColors[update.status]}`}
          />

          <div>
            <div className="flex items-center gap-2">
              <Badge className={statusBadgeColors[update.status]}>
                {update.status}
              </Badge>
              <span className="text-sm text-navy-400">
                {formatDateTime(update.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-navy-200">{update.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
