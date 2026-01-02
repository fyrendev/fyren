"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Maintenance } from "@/lib/api-client";
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
import { Wrench, Plus, Eye } from "lucide-react";
import { format } from "date-fns";

const statusVariants: Record<string, "info" | "warning" | "success"> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
};

type FilterStatus = "all" | "scheduled" | "in_progress" | "completed";

export default function MaintenancePage() {
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    loadMaintenances();
  }, [filter]);

  async function loadMaintenances() {
    setLoading(true);
    try {
      const params = filter === "all" ? "limit=50" : `status=${filter}&limit=50`;
      const data = await api.getMaintenances(params);
      setMaintenances(data.maintenances);
    } catch (err) {
      console.error("Failed to load maintenances:", err);
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
        <h1 className="text-2xl font-semibold text-white">Maintenance</h1>
        <Link href="/admin/maintenance/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Maintenance
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "scheduled", "in_progress", "completed"] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === status
                ? "bg-navy-800 text-white"
                : "text-navy-400 hover:text-white hover:bg-navy-800/50"
            }`}
          >
            {status === "in_progress"
              ? "In Progress"
              : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <Card className="p-0 overflow-hidden">
        {maintenances.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No maintenance scheduled"
            description="Schedule maintenance windows to inform users about planned downtime."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Scheduled Start</TableHead>
              <TableHead>Scheduled End</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {maintenances.map((maintenance) => (
                <TableRow key={maintenance.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-white">{maintenance.title}</p>
                      {maintenance.affectedComponents &&
                        maintenance.affectedComponents.length > 0 && (
                          <p className="text-xs text-navy-500 mt-1">
                            Affecting:{" "}
                            {maintenance.affectedComponents
                              .map((c) => c.component?.name || "Unknown")
                              .join(", ")}
                          </p>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[maintenance.status] || "default"}>
                      {maintenance.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(maintenance.scheduledStartAt), "PPp")}</TableCell>
                  <TableCell>{format(new Date(maintenance.scheduledEndAt), "PPp")}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/maintenance/${maintenance.id}`}
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
