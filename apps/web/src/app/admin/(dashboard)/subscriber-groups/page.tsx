"use client";

import { useEffect, useState } from "react";
import { api, type SubscriberGroup, type Component } from "@/lib/api-client";
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
import { Textarea } from "@/components/admin/ui/Textarea";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";

export default function SubscriberGroupsPage() {
  const [groups, setGroups] = useState<SubscriberGroup[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SubscriberGroup | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    componentIds: string[];
  }>({
    name: "",
    description: "",
    componentIds: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [groupsData, componentsData] = await Promise.all([
        api.getSubscriberGroups(),
        api.getComponents(),
      ]);
      setGroups(groupsData.subscriberGroups);
      setComponents(componentsData.components);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingGroup(null);
    setFormData({ name: "", description: "", componentIds: [] });
    setError(null);
    setModalOpen(true);
  }

  function openEditModal(group: SubscriberGroup) {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      componentIds: group.componentIds || [],
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
        name: formData.name,
        description: formData.description || null,
        componentIds: formData.componentIds.length > 0 ? formData.componentIds : null,
      };

      if (editingGroup) {
        await api.updateSubscriberGroup(editingGroup.id, data);
      } else {
        await api.createSubscriberGroup(data);
      }
      setModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save group";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Are you sure you want to delete this group? This will not delete the subscribers in the group."
      )
    )
      return;

    try {
      await api.deleteSubscriberGroup(id);
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete group";
      alert(message);
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

  function getComponentNames(componentIds: string[] | null): string {
    if (!componentIds || componentIds.length === 0) return "All components";
    const names = componentIds
      .map((id) => components.find((c) => c.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "All components";
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
          <h1 className="text-2xl font-semibold text-white">Subscriber Groups</h1>
          <p className="text-navy-400 text-sm mt-1">
            Organize subscribers into groups with shared notification preferences.
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Group
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No subscriber groups"
            description="Create groups to organize subscribers by company or team."
            action={{ label: "Add Group", onClick: openCreateModal }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Members</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <p className="font-medium text-white">{group.name}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-navy-400 truncate max-w-xs">{group.description || "-"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-navy-400 text-sm truncate max-w-xs">
                      {getComponentNames(group.componentIds)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{group.memberCount}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(group)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                        title="Edit group"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
                        className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                        title="Delete group"
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
        title={editingGroup ? "Edit Group" : "Add Group"}
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
            placeholder="Acme Corp"
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description of this group..."
            rows={2}
          />
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">
              Notify for Components
            </label>
            <p className="text-xs text-navy-400 mb-3">
              Select which components this group should receive notifications for. Leave empty to
              receive notifications for all components.
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
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
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingGroup ? "Save Changes" : "Create Group"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
