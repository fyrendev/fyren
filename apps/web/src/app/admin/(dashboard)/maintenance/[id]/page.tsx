"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, type Maintenance } from "@/lib/api-client";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { ArrowLeft, Play, CheckCircle, X } from "lucide-react";
import { format } from "date-fns";

const statusVariants: Record<string, "info" | "warning" | "success"> = {
  scheduled: "info",
  in_progress: "warning",
  completed: "success",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MaintenanceDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { confirm, dialogProps } = useConfirmDialog();
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMaintenance();
  }, [id]);

  async function loadMaintenance() {
    try {
      const data = await api.getMaintenance(id);
      setMaintenance(data.maintenance);
    } catch (err) {
      console.error("Failed to load maintenance:", err);
      setError("Failed to load maintenance");
    } finally {
      setLoading(false);
    }
  }

  function handleStart() {
    confirm({
      title: "Start Maintenance",
      message: "Are you sure you want to start this maintenance now?",
      confirmLabel: "Start",
      variant: "primary",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.startMaintenance(id);
          toast.success("Maintenance started");
          loadMaintenance();
        } catch (err) {
          console.error("Failed to start maintenance:", err);
          toast.error("Failed to start maintenance");
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  function handleComplete() {
    confirm({
      title: "Complete Maintenance",
      message: "Are you sure you want to mark this maintenance as complete?",
      confirmLabel: "Complete",
      variant: "primary",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.completeMaintenance(id);
          toast.success("Maintenance completed");
          loadMaintenance();
        } catch (err) {
          console.error("Failed to complete maintenance:", err);
          toast.error("Failed to complete maintenance");
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  function handleCancel() {
    confirm({
      title: "Cancel Maintenance",
      message: "Are you sure you want to cancel this maintenance?",
      confirmLabel: "Cancel Maintenance",
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await api.cancelMaintenance(id);
          toast.success("Maintenance cancelled");
          router.push("/admin/maintenance");
        } catch (err) {
          console.error("Failed to cancel maintenance:", err);
          toast.error("Failed to cancel maintenance");
        } finally {
          setActionLoading(false);
        }
      },
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-navy-400">Loading...</div>
      </div>
    );
  }

  if (error || !maintenance) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error || "Maintenance not found"}</div>
      </div>
    );
  }

  const isScheduled = maintenance.status === "scheduled";
  const isInProgress = maintenance.status === "in_progress";
  const isCompleted = maintenance.status === "completed";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/admin/maintenance"
        className="inline-flex items-center gap-2 text-navy-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Maintenance
      </Link>

      {/* Maintenance Header */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">{maintenance.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={statusVariants[maintenance.status]}>
                {maintenance.status.replace("_", " ")}
              </Badge>
              <span className="text-sm text-navy-400">
                Created {format(new Date(maintenance.createdAt), "PPp")}
              </span>
            </div>
          </div>

          {!isCompleted && (
            <div className="flex gap-2">
              {isScheduled && (
                <>
                  <Button variant="secondary" onClick={handleStart} loading={actionLoading}>
                    <Play className="w-4 h-4 mr-2" />
                    Start Now
                  </Button>
                  <Button variant="danger" onClick={handleCancel} loading={actionLoading}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
              {isInProgress && (
                <Button variant="primary" onClick={handleComplete} loading={actionLoading}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete
                </Button>
              )}
            </div>
          )}
        </div>

        {maintenance.description && (
          <div className="mt-4 pt-4 border-t border-navy-800">
            <p className="text-navy-300">{maintenance.description}</p>
          </div>
        )}
      </Card>

      {/* Schedule Details */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-navy-800/50 rounded-lg">
              <p className="text-sm text-navy-400">Scheduled Start</p>
              <p className="text-white mt-1">
                {format(new Date(maintenance.scheduledStartAt), "PPp")}
              </p>
            </div>
            <div className="p-4 bg-navy-800/50 rounded-lg">
              <p className="text-sm text-navy-400">Scheduled End</p>
              <p className="text-white mt-1">
                {format(new Date(maintenance.scheduledEndAt), "PPp")}
              </p>
            </div>
          </div>

          {(maintenance.actualStartAt || maintenance.actualEndAt) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {maintenance.actualStartAt && (
                <div className="p-4 bg-navy-800/50 rounded-lg">
                  <p className="text-sm text-navy-400">Actual Start</p>
                  <p className="text-white mt-1">
                    {format(new Date(maintenance.actualStartAt), "PPp")}
                  </p>
                </div>
              )}
              {maintenance.actualEndAt && (
                <div className="p-4 bg-navy-800/50 rounded-lg">
                  <p className="text-sm text-navy-400">Actual End</p>
                  <p className="text-white mt-1">
                    {format(new Date(maintenance.actualEndAt), "PPp")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Affected Components */}
      {maintenance.affectedComponents && maintenance.affectedComponents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Affected Components</CardTitle>
          </CardHeader>

          <div className="space-y-2">
            {maintenance.affectedComponents.map((c) => (
              <div key={c.componentId} className="p-3 bg-navy-800/50 rounded-lg">
                <p className="text-white">{c.component?.name || "Unknown"}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
