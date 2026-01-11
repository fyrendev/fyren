import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getIncident, getStatus } from "@/lib/api";
import { IncidentTimeline } from "@/components/incidents/IncidentTimeline";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";
import { OrganizationTheme } from "@/components/status/ThemeProvider";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const [statusData, incidentData] = await Promise.all([getStatus(), getIncident(id)]);
    return {
      title: `${incidentData.incident.title} | ${statusData.organization.name} Status`,
      description: incidentData.incident.updates[0]?.message,
    };
  } catch {
    return { title: "Incident" };
  }
}

export default async function IncidentPage({ params }: Props) {
  const { id } = await params;

  let statusData;
  let incident;

  try {
    const [status, incidentData] = await Promise.all([getStatus(), getIncident(id)]);
    statusData = status;
    incident = incidentData.incident;
  } catch {
    notFound();
  }

  return (
    <OrganizationTheme organization={statusData.organization}>
      <div className="min-h-screen status-page-bg">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-2 brand-link mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to status
          </Link>

          <div className="theme-card p-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold">{incident.title}</h1>
              <div className="flex gap-2">
                <Badge className={severityColors[incident.severity]}>{incident.severity}</Badge>
                <Badge className={statusColors[incident.status]}>{incident.status}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-sm theme-muted">
              <span>Started: {formatDateTime(incident.startedAt)}</span>
              {incident.resolvedAt && <span>Resolved: {formatDateTime(incident.resolvedAt)}</span>}
            </div>

            {incident.affectedComponents.length > 0 && (
              <div className="mt-4">
                <span className="text-sm theme-muted opacity-70">Affected components: </span>
                <span className="text-sm">
                  {incident.affectedComponents.map((c) => c.name).join(", ")}
                </span>
              </div>
            )}

            <hr className="my-6" style={{ borderColor: "var(--card-border)" }} />

            <h2 className="text-lg font-medium mb-4">Updates</h2>
            {incident.updates.length > 0 ? (
              <IncidentTimeline updates={incident.updates} />
            ) : (
              <p className="theme-muted">No updates yet.</p>
            )}
          </div>
        </div>
      </div>
    </OrganizationTheme>
  );
}
