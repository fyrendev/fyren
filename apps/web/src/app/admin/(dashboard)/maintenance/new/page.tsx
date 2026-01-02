"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Component } from "@/lib/api-client";
import { Card } from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";
import { Textarea } from "@/components/admin/ui/Textarea";
import { ArrowLeft } from "lucide-react";

export default function NewMaintenancePage() {
  const router = useRouter();
  const [components, setComponents] = useState<Component[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduledStartAt: "",
    scheduledEndAt: "",
    componentIds: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getComponents()
      .then((data) => setComponents(data.components))
      .catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const result = await api.createMaintenance({
        ...formData,
        scheduledStartAt: new Date(formData.scheduledStartAt).toISOString(),
        scheduledEndAt: new Date(formData.scheduledEndAt).toISOString(),
      });
      router.push(`/admin/maintenance/${result.maintenance.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to schedule maintenance";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function toggleComponent(id: string) {
    setFormData((prev) => ({
      ...prev,
      componentIds: prev.componentIds.includes(id)
        ? prev.componentIds.filter((c) => c !== id)
        : [...prev.componentIds, id],
    }));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/admin/maintenance"
        className="inline-flex items-center gap-2 text-navy-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Maintenance
      </Link>

      <h1 className="text-2xl font-semibold text-white">Schedule Maintenance</h1>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Title"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            placeholder="Scheduled database maintenance"
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="We will be performing routine database maintenance..."
            rows={4}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Scheduled Start"
              type="datetime-local"
              value={formData.scheduledStartAt}
              onChange={(e) =>
                setFormData({ ...formData, scheduledStartAt: e.target.value })
              }
              required
            />
            <Input
              label="Scheduled End"
              type="datetime-local"
              value={formData.scheduledEndAt}
              onChange={(e) =>
                setFormData({ ...formData, scheduledEndAt: e.target.value })
              }
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">
              Affected Components
            </label>
            <div className="space-y-2">
              {components.map((component) => (
                <label
                  key={component.id}
                  className="flex items-center gap-3 p-3 bg-navy-800 rounded-lg cursor-pointer hover:bg-navy-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={formData.componentIds.includes(component.id)}
                    onChange={() => toggleComponent(component.id)}
                    className="w-4 h-4 rounded border-navy-600 bg-navy-700 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-white">{component.name}</span>
                </label>
              ))}
              {components.length === 0 && (
                <p className="text-navy-400 text-sm">No components available</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/admin/maintenance">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={saving}>
              Schedule Maintenance
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
