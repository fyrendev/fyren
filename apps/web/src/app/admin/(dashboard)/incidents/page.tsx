"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Incident } from "@/lib/api-client";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Badge } from "@/components/admin/ui/Badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/admin/ui/Table";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { AlertTriangle, Plus, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const statusVariants: Record<string, "danger" | "warning" | "info" | "success"> = {
  investigating: "danger",
  identified: "warning",
  monitoring: "info",
  resolved: "success",
};

const severityVariants: Record<string, "warning" | "danger"> = {
  minor: "warning",
  major: "danger",
  critical: "danger",
};

type FilterStatus = "all" | "active" | "resolved";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    loadIncidents();
  }, [filter]);

  async function loadIncidents() {
    setLoading(true);
    try {
      const params = filter === "all" ? "limit=50" : `status=${filter}&limit=50`;
      const data = await api.getIncidents(params);
      setIncidents(data.incidents);
    } catch (err) {
      console.error("Failed to load incidents:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-navy-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Incidents</h1>
        <Link href="/admin/incidents/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Report Incident
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "active", "resolved"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === status
                ? "bg-navy-800 text-white"
                : "text-navy-400 hover:text-white hover:bg-navy-800/50"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {incidents.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No incidents"
            description={
              filter === "active"
                ? "No active incidents. All systems operational!"
                : "No incidents to display."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Incident</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => (
                <TableRow key={incident.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-white">{incident.title}</p>
                      {incident.affectedComponents && incident.affectedComponents.length > 0 && (
                        <p className="text-xs text-navy-500 mt-1">
                          Affecting:{" "}
                          {incident.affectedComponents
                            .map((c) => c.component?.name || "Unknown")
                            .join(", ")}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[incident.status]}>{incident.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={severityVariants[incident.severity]}>{incident.severity}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(incident.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/incidents/${incident.id}`}
                      className="p-1 text-navy-400 hover:text-white transition-colors inline-flex"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
