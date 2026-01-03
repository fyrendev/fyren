"use client";

import { useEffect, useState } from "react";
import { api, type Subscriber, type SubscriberGroup, type Component } from "@/lib/api-client";
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
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [groups, setGroups] = useState<SubscriberGroup[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [formData, setFormData] = useState<{
    email: string;
    groupId: string;
    componentIds: string[];
    notifyOnIncident: boolean;
    notifyOnMaintenance: boolean;
  }>({
    email: "",
    groupId: "",
    componentIds: [],
    notifyOnIncident: true,
    notifyOnMaintenance: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [subsData, groupsData, componentsData] = await Promise.all([
        api.getSubscribers("limit=100"),
        api.getSubscriberGroups(),
        api.getComponents(),
      ]);
      setSubscribers(subsData.subscribers);
      setTotal(subsData.pagination.total);
      setGroups(groupsData.subscriberGroups);
      setComponents(componentsData.components);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingSubscriber(null);
    setFormData({
      email: "",
      groupId: "",
      componentIds: [],
      notifyOnIncident: true,
      notifyOnMaintenance: true,
    });
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(subscriber: Subscriber) {
    setEditingSubscriber(subscriber);
    setFormData({
      email: subscriber.email,
      groupId: subscriber.groupId || "",
      componentIds: subscriber.componentIds || [],
      notifyOnIncident: subscriber.notifyOnIncident,
      notifyOnMaintenance: subscriber.notifyOnMaintenance,
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
        email: formData.email,
        groupId: formData.groupId || null,
        componentIds: formData.componentIds.length > 0 ? formData.componentIds : null,
        notifyOnIncident: formData.notifyOnIncident,
        notifyOnMaintenance: formData.notifyOnMaintenance,
      };

      if (editingSubscriber) {
        await api.updateSubscriber(editingSubscriber.id, data);
      } else {
        await api.createSubscriber(data);
      }
      setModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save subscriber";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this subscriber?")) return;

    try {
      await api.deleteSubscriber(id);
      loadData();
    } catch (err) {
      console.error("Failed to delete subscriber:", err);
    }
  }

  function toggleComponent(componentId: string) {
    setFormData((prev) => {
      const newIds = prev.componentIds.includes(componentId)
        ? prev.componentIds.filter((id) => id !== componentId)
        : [...prev.componentIds, componentId];
      return { ...prev, componentIds: newIds };
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
        <div>
          <h1 className="text-2xl font-semibold text-white">Subscribers</h1>
          <p className="text-navy-400 text-sm mt-1">
            {total} total subscriber{total !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Subscriber
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {subscribers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No subscribers yet"
            description="Add subscribers manually or let them subscribe from your status page."
            action={{ label: "Add Subscriber", onClick: openCreateModal }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Email</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notifications</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell>
                    <p className="font-medium text-white">{subscriber.email}</p>
                  </TableCell>
                  <TableCell>
                    {subscriber.group ? (
                      <Badge variant="info">{subscriber.group.name}</Badge>
                    ) : (
                      <span className="text-navy-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={subscriber.verified ? "success" : "warning"}>
                      {subscriber.verified ? "Verified" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {subscriber.notifyOnIncident && (
                        <Badge variant="default" className="text-xs">
                          Incidents
                        </Badge>
                      )}
                      {subscriber.notifyOnMaintenance && (
                        <Badge variant="default" className="text-xs">
                          Maintenance
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{format(new Date(subscriber.createdAt), "PP")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(subscriber)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                        title="Edit subscriber"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(subscriber.id)}
                        className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                        title="Delete subscriber"
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
        title={editingSubscriber ? "Edit Subscriber" : "Add Subscriber"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="subscriber@example.com"
            required
          />

          <Select
            label="Group (optional)"
            value={formData.groupId}
            onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
            options={[
              { value: "", label: "No group" },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />

          {!formData.groupId && (
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">
                Subscribe to Components
              </label>
              <p className="text-xs text-navy-400 mb-3">
                Select components to receive notifications for. Leave empty for all.
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {components.length === 0 ? (
                  <p className="text-navy-400 text-sm">No components available</p>
                ) : (
                  components.map((component) => (
                    <label
                      key={component.id}
                      className="flex items-center gap-3 p-2 rounded hover:bg-navy-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.componentIds.includes(component.id)}
                        onChange={() => toggleComponent(component.id)}
                        className="w-4 h-4 rounded border-navy-600 bg-navy-700 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-white text-sm">{component.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {formData.groupId && (
            <div className="p-3 bg-navy-700/50 rounded-lg">
              <p className="text-navy-400 text-sm">
                Component filter is managed by the group. Remove from group to set individual
                filters.
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">
              Notification Preferences
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
            </div>
          </div>

          {!editingSubscriber && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-sm">
                Manually added subscribers are automatically verified and will start receiving
                notifications immediately.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingSubscriber ? "Save Changes" : "Add Subscriber"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
