"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { WebhookType } from "@fyrendev/shared";
import { api, type WebhookEndpoint } from "@/lib/api-client";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
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
import { Webhook, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Play } from "lucide-react";

const typeOptions = [
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "generic", label: "Generic Webhook" },
];

export default function WebhooksPage() {
  const { confirm, dialogProps } = useConfirmDialog();
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    url: string;
    type: WebhookType;
    notifyOnIncident: boolean;
    notifyOnMaintenance: boolean;
    notifyOnComponentChange: boolean;
  }>({
    name: "",
    url: "",
    type: "generic",
    notifyOnIncident: true,
    notifyOnMaintenance: true,
    notifyOnComponentChange: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    success: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadWebhooks();
  }, []);

  async function loadWebhooks() {
    try {
      const data = await api.getWebhooks();
      setWebhooks(data.webhooks);
    } catch (err) {
      console.error("Failed to load webhooks:", err);
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingWebhook(null);
    setFormData({
      name: "",
      url: "",
      type: "generic",
      notifyOnIncident: true,
      notifyOnMaintenance: true,
      notifyOnComponentChange: false,
    });
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(webhook: WebhookEndpoint) {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      type: webhook.type,
      notifyOnIncident: webhook.notifyOnIncident,
      notifyOnMaintenance: webhook.notifyOnMaintenance,
      notifyOnComponentChange: webhook.notifyOnComponentChange,
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingWebhook) {
        await api.updateWebhook(editingWebhook.id, formData);
      } else {
        await api.createWebhook(formData);
      }
      setModalOpen(false);
      loadWebhooks();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save webhook";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      await api.toggleWebhook(id);
      loadWebhooks();
    } catch (err) {
      console.error("Failed to toggle webhook:", err);
      toast.error("Failed to toggle webhook");
    }
  }

  async function handleTest(id: string) {
    setTestResult(null);
    try {
      const result = await api.testWebhook(id);
      setTestResult({ id, ...result });
      setTimeout(() => setTestResult(null), 5000);
    } catch (err) {
      console.error("Failed to test webhook:", err);
      setTestResult({ id, success: false, error: "Failed to send test" });
      setTimeout(() => setTestResult(null), 5000);
    }
  }

  function handleDelete(id: string) {
    confirm({
      title: "Delete Webhook",
      message: "Are you sure you want to delete this webhook?",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await api.deleteWebhook(id);
          toast.success("Webhook deleted");
          loadWebhooks();
        } catch (err) {
          console.error("Failed to delete webhook:", err);
          toast.error("Failed to delete webhook");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Webhooks</h1>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {webhooks.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks configured"
            description="Add webhooks to send notifications to Slack, Discord, Teams, or custom endpoints."
            action={{ label: "Add Webhook", onClick: openCreateModal }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Notifications</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <p className="font-medium text-white">{webhook.name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{webhook.type}</Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-navy-400 truncate max-w-xs">{webhook.url}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {webhook.notifyOnIncident && (
                        <Badge variant="default" className="text-xs">
                          Incidents
                        </Badge>
                      )}
                      {webhook.notifyOnMaintenance && (
                        <Badge variant="default" className="text-xs">
                          Maintenance
                        </Badge>
                      )}
                      {webhook.notifyOnComponentChange && (
                        <Badge variant="default" className="text-xs">
                          Status Changes
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={webhook.enabled ? "success" : "default"}>
                      {webhook.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    {testResult?.id === webhook.id && (
                      <Badge variant={testResult.success ? "success" : "danger"} className="ml-2">
                        {testResult.success ? "Test sent" : "Test failed"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(webhook.id)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                        title={webhook.enabled ? "Disable" : "Enable"}
                      >
                        {webhook.enabled ? (
                          <ToggleRight className="w-4 h-4 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleTest(webhook.id)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                        title="Test webhook"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(webhook)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(webhook.id)}
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
        title={editingWebhook ? "Edit Webhook" : "Add Webhook"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Slack Notifications"
            required
          />
          <Select
            label="Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as WebhookType })}
            options={typeOptions}
          />
          <Input
            label="Webhook URL"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://hooks.slack.com/services/..."
            required
          />
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">
              Notification Events
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-2 rounded hover:bg-navy-700/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyOnIncident}
                  onChange={(e) => setFormData({ ...formData, notifyOnIncident: e.target.checked })}
                  className="w-4 h-4 rounded border-navy-600 bg-navy-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-white text-sm">Notify on incidents</span>
              </label>
              <label className="flex items-center gap-3 p-2 rounded hover:bg-navy-700/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyOnMaintenance}
                  onChange={(e) =>
                    setFormData({ ...formData, notifyOnMaintenance: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-navy-600 bg-navy-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-white text-sm">Notify on maintenance</span>
              </label>
              <label className="flex items-center gap-3 p-2 rounded hover:bg-navy-700/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyOnComponentChange}
                  onChange={(e) =>
                    setFormData({ ...formData, notifyOnComponentChange: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-navy-600 bg-navy-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-white text-sm">Notify on component status changes</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingWebhook ? "Save Changes" : "Create Webhook"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
