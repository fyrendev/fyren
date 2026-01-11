import type { Incident } from "@/lib/types";
import { IncidentCard } from "./IncidentCard";

interface Props {
  incidents: Incident[];
}

export function IncidentList({ incidents }: Props) {
  return (
    <div className="space-y-4">
      {incidents.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} />
      ))}
    </div>
  );
}
