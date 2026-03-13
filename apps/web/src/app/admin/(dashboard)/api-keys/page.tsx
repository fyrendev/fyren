"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, type ApiKey } from "@/lib/api-client";
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
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function ApiKeysPage() {
  const { confirm, dialogProps } = useConfirmDialog();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    expiresAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    try {
      const data = await api.getApiKeys();
      setApiKeys(data.apiKeys);
    } catch (err) {
      console.error("Failed to load API keys:", err);
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setFormData({ name: "", expiresAt: "" });
    setError(null);
    setNewKey(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await api.createApiKey({
        name: formData.name,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
      });
      setNewKey(result.plainKey);
      loadApiKeys();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create API key";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(id: string) {
    confirm({
      title: "Revoke API Key",
      message: "Are you sure you want to revoke this API key? This cannot be undone.",
      confirmLabel: "Revoke",
      onConfirm: async () => {
        try {
          await api.deleteApiKey(id);
          toast.success("API key revoked");
          loadApiKeys();
        } catch (err) {
          console.error("Failed to delete API key:", err);
          toast.error("Failed to revoke API key");
        }
      },
    });
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
        <h1 className="text-2xl font-semibold text-white">API Keys</h1>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Create API Key
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        {apiKeys.length === 0 ? (
          <EmptyState
            icon={Key}
            title="No API keys"
            description="Create API keys for programmatic access to the admin API."
            action={{ label: "Create API Key", onClick: openCreateModal }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Name</TableHead>
              <TableHead>Key Prefix</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {apiKeys.map((apiKey) => (
                <TableRow key={apiKey.id}>
                  <TableCell>
                    <p className="font-medium text-white">{apiKey.name}</p>
                  </TableCell>
                  <TableCell>
                    <code className="px-2 py-1 bg-navy-800 rounded text-sm text-navy-300">
                      {apiKey.keyPrefix}...
                    </code>
                  </TableCell>
                  <TableCell>
                    {apiKey.lastUsedAt
                      ? formatDistanceToNow(new Date(apiKey.lastUsedAt), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    {apiKey.expiresAt ? (
                      <Badge
                        variant={new Date(apiKey.expiresAt) < new Date() ? "danger" : "default"}
                      >
                        {format(new Date(apiKey.expiresAt), "PP")}
                      </Badge>
                    ) : (
                      <span className="text-navy-500">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDelete(apiKey.id)}
                      className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setNewKey(null);
        }}
        title={newKey ? "API Key Created" : "Create API Key"}
      >
        {newKey ? (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-yellow-400 text-sm">
                Make sure to copy your API key now. You won&apos;t be able to see it again!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 bg-navy-800 rounded-lg text-sm text-white font-mono overflow-x-auto">
                {newKey}
              </code>
              <Button variant="secondary" size="sm" onClick={() => copyToClipboard(newKey, "new")}>
                {copiedId === "new" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                onClick={() => {
                  setModalOpen(false);
                  setNewKey(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
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
              placeholder="CI/CD Pipeline"
              required
            />
            <Input
              label="Expires At (optional)"
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
            />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                Create Key
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
