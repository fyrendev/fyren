"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type Component } from "@/lib/api-client";
import { Card } from "@/components/admin/ui/Card";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";
import { Textarea } from "@/components/admin/ui/Textarea";
import { Select } from "@/components/admin/ui/Select";
import { ArrowLeft } from "lucide-react";

const severityOptions = [
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "critical", label: "Critical" },
];

export default function NewIncidentPage() {
  const router = useRouter();
  const [components, setComponents] = useState<Component[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    severity: "minor",
    message: "",
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
      const result = await api.createIncident(formData);
      router.push(`/admin/incidents/${result.incident.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create incident";
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
        href="/admin/incidents"
        className="inline-flex items-center gap-2 text-navy-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Incidents
      </Link>

      <h1 className="text-2xl font-semibold text-white">Report Incident</h1>

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
            placeholder="Brief description of the incident"
            required
          />

          <Select
            label="Severity"
            value={formData.severity}
            onChange={(e) =>
              setFormData({ ...formData, severity: e.target.value })
            }
            options={severityOptions}
          />

          <Textarea
            label="Initial Update"
            value={formData.message}
            onChange={(e) =>
              setFormData({ ...formData, message: e.target.value })
            }
            placeholder="We are currently investigating..."
            rows={4}
            required
          />

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
            <Link href="/admin/incidents">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={saving}>
              Create Incident
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
