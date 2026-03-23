"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, type Component } from "@/lib/api-client";
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
import { Textarea } from "@/components/admin/ui/Textarea";
import { Select } from "@/components/admin/ui/Select";
import { Box, Plus, Pencil, Trash2 } from "lucide-react";

const statusOptions = [
  { value: "operational", label: "Operational" },
  { value: "degraded_performance", label: "Degraded Performance" },
  { value: "partial_outage", label: "Partial Outage" },
  { value: "major_outage", label: "Major Outage" },
  { value: "under_maintenance", label: "Under Maintenance" },
];

const statusVariants: Record<string, "success" | "warning" | "danger" | "info"> = {
  operational: "success",
  degraded_performance: "warning",
  degraded: "warning",
  partial_outage: "danger",
  major_outage: "danger",
  under_maintenance: "info",
  maintenance: "info",
};

export default function ComponentsPage() {
  const { confirm, dialogProps } = useConfirmDialog();
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "operational",
    group: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadComponents();
  }, []);

  async function loadComponents() {
    try {
      const data = await api.getComponents();
      setComponents(data.components);
    } catch (err) {
      console.error("Failed to load components:", err);
      toast.error("Failed to load components");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingComponent(null);
    setFormData({ name: "", description: "", status: "operational", group: "" });
    setModalOpen(true);
  }

  function openEditModal(component: Component) {
    setEditingComponent(component);
    setFormData({
      name: component.name,
      description: component.description || "",
      status: component.status,
      group: component.group || "",
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (editingComponent) {
        await api.updateComponent(editingComponent.id, formData);
      } else {
        await api.createComponent(formData);
      }
      setModalOpen(false);
      loadComponents();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save component";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    confirm({
      title: "Delete Component",
      message:
        "Are you sure you want to delete this component? Associated monitors will also be removed.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        try {
          await api.deleteComponent(id);
          toast.success("Component deleted");
          loadComponents();
        } catch (err) {
          console.error("Failed to delete component:", err);
          toast.error("Failed to delete component");
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
        <h1 className="text-2xl font-semibold text-white">Components</h1>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Component
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {components.length === 0 ? (
          <EmptyState
            icon={Box}
            title="No components yet"
            description="Components represent the services you want to monitor."
            action={{ label: "Add Component", onClick: openCreateModal }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {components.map((component) => (
                <TableRow key={component.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-white">{component.name}</p>
                      {component.description && (
                        <p className="text-xs text-navy-500 mt-1">{component.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[component.status] || "default"}>
                      {component.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{component.group || "—"}</TableCell>
                  <TableCell>{new Date(component.updatedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(component)}
                        className="p-1 text-navy-400 hover:text-white transition-colors"
                        title="Edit component"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(component.id)}
                        className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                        title="Delete component"
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
        title={editingComponent ? "Edit Component" : "Add Component"}
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
            placeholder="API Server"
            required
          />
          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Core API services"
            rows={3}
          />
          <Select
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={statusOptions}
          />
          <Input
            label="Group (optional)"
            value={formData.group}
            onChange={(e) => setFormData({ ...formData, group: e.target.value })}
            placeholder="Infrastructure"
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingComponent ? "Save Changes" : "Create Component"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
