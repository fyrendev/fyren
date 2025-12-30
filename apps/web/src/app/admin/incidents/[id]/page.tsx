"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { api, type Incident, type IncidentUpdate } from "@/lib/api-client";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";
import { Badge } from "@/components/admin/ui/Badge";
import { Modal } from "@/components/admin/ui/Modal";
import { Textarea } from "@/components/admin/ui/Textarea";
import { Select } from "@/components/admin/ui/Select";
import { ArrowLeft, Plus, CheckCircle } from "lucide-react";
import { format } from "date-fns";

const statusOptions = [
  { value: "investigating", label: "Investigating" },
  { value: "identified", label: "Identified" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
];

const statusColors: Record<string, string> = {
  investigating: "bg-red-500",
  identified: "bg-orange-500",
  monitoring: "bg-blue-500",
  resolved: "bg-green-500",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function IncidentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [updateData, setUpdateData] = useState({ status: "monitoring", message: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadIncident();
  }, [id]);

  async function loadIncident() {
    try {
      const data = await api.getIncident(id);
      setIncident(data.incident);
    } catch (err) {
      console.error("Failed to load incident:", err);
      setError("Failed to load incident");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await api.addIncidentUpdate(id, updateData);
      setUpdateModalOpen(false);
      setUpdateData({ status: "monitoring", message: "" });
      loadIncident();
    } catch (err) {
      console.error("Failed to add update:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleResolve() {
    if (!confirm("Are you sure you want to resolve this incident?")) return;

    setSaving(true);
    try {
      await api.resolveIncident(id);
      loadIncident();
    } catch (err) {
      console.error("Failed to resolve incident:", err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-navy-400">Loading...</div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error || "Incident not found"}</div>
      </div>
    );
  }

  const isResolved = incident.status === "resolved";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        href="/admin/incidents"
        className="inline-flex items-center gap-2 text-navy-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Incidents
      </Link>

      {/* Incident Header */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">
              {incident.title}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge variant={isResolved ? "success" : "danger"}>
                {incident.status}
              </Badge>
              <Badge variant="warning">{incident.severity}</Badge>
              <span className="text-sm text-navy-400">
                Created {format(new Date(incident.createdAt), "PPp")}
              </span>
            </div>
          </div>

          {!isResolved && (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setUpdateData({ status: incident.status, message: "" });
                  setUpdateModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Update
              </Button>
              <Button variant="primary" onClick={handleResolve} loading={saving}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Resolve
              </Button>
            </div>
          )}
        </div>

        {incident.affectedComponents && incident.affectedComponents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-navy-800">
            <p className="text-sm text-navy-400">
              <span className="text-navy-500">Affected components:</span>{" "}
              {incident.affectedComponents
                .map((c) => c.component?.name || "Unknown")
                .join(", ")}
            </p>
          </div>
        )}
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Updates</CardTitle>
        </CardHeader>

        <div className="space-y-6">
          {incident.updates && incident.updates.length > 0 ? (
            incident.updates.map((update: IncidentUpdate, index: number) => (
              <div key={update.id} className="relative pl-6">
                {index < (incident.updates?.length || 0) - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-0 w-0.5 bg-navy-700" />
                )}
                <div
                  className={`absolute left-0 top-1.5 w-4 h-4 rounded-full ${
                    statusColors[update.status] || "bg-navy-500"
                  }`}
                />

                <div>
                  <div className="flex items-center gap-2">
                    <Badge>{update.status}</Badge>
                    <span className="text-sm text-navy-400">
                      {format(new Date(update.createdAt), "PPp")}
                    </span>
                  </div>
                  <p className="mt-2 text-navy-200">{update.message}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-navy-400 text-sm">No updates yet</p>
          )}
        </div>
      </Card>

      {/* Add Update Modal */}
      <Modal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
        title="Add Update"
      >
        <form onSubmit={handleAddUpdate} className="space-y-4">
          <Select
            label="Status"
            value={updateData.status}
            onChange={(e) =>
              setUpdateData({ ...updateData, status: e.target.value })
            }
            options={statusOptions}
          />
          <Textarea
            label="Message"
            value={updateData.message}
            onChange={(e) =>
              setUpdateData({ ...updateData, message: e.target.value })
            }
            placeholder="Describe the update..."
            rows={4}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setUpdateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Post Update
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
