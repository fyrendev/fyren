"use client";

import { useEffect, useState } from "react";
import { api, type Monitor, type Component } from "@/lib/api-client";
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
import { Modal } from "@/components/admin/ui/Modal";
import { Input } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { Activity, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const typeOptions = [
  { value: "http", label: "HTTP/HTTPS" },
  { value: "tcp", label: "TCP Port" },
  { value: "ssl_expiry", label: "SSL Certificate" },
];

const intervalOptions = [
  { value: "30", label: "30 seconds" },
  { value: "60", label: "1 minute" },
  { value: "300", label: "5 minutes" },
  { value: "600", label: "10 minutes" },
  { value: "900", label: "15 minutes" },
];

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null);
  const [formData, setFormData] = useState({
    componentId: "",
    type: "http",
    url: "",
    intervalSeconds: "60",
    timeoutMs: "5000",
    expectedStatusCode: "200",
    failureThreshold: "3",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [monitorsRes, componentsRes] = await Promise.all([
        api.getMonitors(),
        api.getComponents(),
      ]);
      setMonitors(monitorsRes.monitors);
      setComponents(componentsRes.components);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingMonitor(null);
    setFormData({
      componentId: components[0]?.id || "",
      type: "http",
      url: "",
      intervalSeconds: "60",
      timeoutMs: "5000",
      expectedStatusCode: "200",
      failureThreshold: "3",
    });
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(monitor: Monitor) {
    setEditingMonitor(monitor);
    setFormData({
      componentId: monitor.componentId,
      type: monitor.type,
      url: monitor.url,
      intervalSeconds: String(monitor.intervalSeconds),
      timeoutMs: String(monitor.timeoutMs),
      expectedStatusCode: String(monitor.expectedStatusCode || 200),
      failureThreshold: String(monitor.failureThreshold),
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const data = {
        componentId: formData.componentId,
        type: formData.type as "http" | "tcp" | "ssl_expiry",
        url: formData.url,
        intervalSeconds: parseInt(formData.intervalSeconds),
        timeoutMs: parseInt(formData.timeoutMs),
        expectedStatusCode: formData.type === "http" ? parseInt(formData.expectedStatusCode) : null,
        failureThreshold: parseInt(formData.failureThreshold),
      };

      if (editingMonitor) {
        await api.updateMonitor(editingMonitor.id, data);
      } else {
        await api.createMonitor(data);
      }
      setModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save monitor";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      await api.toggleMonitor(id);
      loadData();
    } catch (err) {
      console.error("Failed to toggle monitor:", err);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this monitor?")) return;

    try {
      await api.deleteMonitor(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete monitor:", err);
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
        <h1 className="text-2xl font-semibold text-white">Monitors</h1>
        <Button onClick={openCreateModal} disabled={components.length === 0}>
          <Plus className="w-4 h-4 mr-2" />
          Add Monitor
        </Button>
      </div>

      {components.length === 0 && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
          You need to create at least one component before adding monitors.
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {monitors.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No monitors configured"
            description="Add monitors to automatically check the health of your services."
            action={
              components.length > 0 ? { label: "Add Monitor", onClick: openCreateModal } : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Component</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Check</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {monitors.map((monitor) => (
                <TableRow key={monitor.id}>
                  <TableCell>
                    <p className="font-medium text-white">{monitor.component?.name || "Unknown"}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{monitor.type.toUpperCase()}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-navy-400 truncate max-w-xs">{monitor.url}</p>
                  </TableCell>
                  <TableCell>
                    {monitor.lastStatus ? (
                      <Badge variant={monitor.lastStatus === "up" ? "success" : "danger"}>
                        {monitor.lastStatus}
                      </Badge>
                    ) : (
                      <span className="text-navy-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {monitor.lastCheckedAt
                      ? formatDistanceToNow(new Date(monitor.lastCheckedAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(monitor.id)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                        title={monitor.isActive ? "Disable" : "Enable"}
                      >
                        {monitor.isActive ? (
                          <ToggleRight className="w-4 h-4 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditModal(monitor)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(monitor.id)}
                        className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMonitor ? "Edit Monitor" : "Add Monitor"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <Select
            label="Component"
            value={formData.componentId}
            onChange={(e) => setFormData({ ...formData, componentId: e.target.value })}
            options={components.map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Monitor Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={typeOptions}
          />
          <Input
            label="URL"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder={
              formData.type === "http"
                ? "https://api.example.com/health"
                : formData.type === "tcp"
                  ? "tcp://db.example.com:5432"
                  : "https://example.com"
            }
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Check Interval"
              value={formData.intervalSeconds}
              onChange={(e) => setFormData({ ...formData, intervalSeconds: e.target.value })}
              options={intervalOptions}
            />
            <Input
              label="Timeout (ms)"
              type="number"
              value={formData.timeoutMs}
              onChange={(e) => setFormData({ ...formData, timeoutMs: e.target.value })}
              min="1000"
              max="30000"
            />
          </div>
          {formData.type === "http" && (
            <Input
              label="Expected Status Code"
              type="number"
              value={formData.expectedStatusCode}
              onChange={(e) => setFormData({ ...formData, expectedStatusCode: e.target.value })}
              min="100"
              max="599"
            />
          )}
          <Input
            label="Failure Threshold"
            type="number"
            value={formData.failureThreshold}
            onChange={(e) => setFormData({ ...formData, failureThreshold: e.target.value })}
            min="1"
            max="10"
          />
          <p className="text-xs text-navy-400">
            Number of consecutive failures before status changes
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingMonitor ? "Save Changes" : "Create Monitor"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
