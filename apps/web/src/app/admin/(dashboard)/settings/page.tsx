"use client";

import { useEffect, useState } from "react";
import { api, type Organization } from "@/lib/api-client";
import { Button } from "@/components/admin/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";
import { Textarea } from "@/components/admin/ui/Textarea";

export default function SettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    websiteUrl: "",
    logoUrl: "",
    brandColor: "",
    customDomain: "",
    timezone: "",
  });

  useEffect(() => {
    loadOrganization();
  }, []);

  async function loadOrganization() {
    try {
      const data = await api.getOrganization();
      setOrganization(data.organization);
      setFormData({
        name: data.organization.name || "",
        slug: data.organization.slug || "",
        websiteUrl: data.organization.websiteUrl || "",
        logoUrl: data.organization.logoUrl || "",
        brandColor: data.organization.brandColor || "",
        customDomain: data.organization.customDomain || "",
        timezone: data.organization.timezone || "UTC",
      });
    } catch (err) {
      console.error("Failed to load organization:", err);
      setError("Failed to load organization settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await api.updateOrganization(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update settings";
      setError(message);
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

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold text-white">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
            Settings saved successfully!
          </div>
        )}

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Organization Name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Acme Inc"
              required
            />
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(e) =>
                setFormData({ ...formData, slug: e.target.value })
              }
              placeholder="acme"
              required
            />
            <p className="text-xs text-navy-400">
              Your status page URL: {formData.slug}.fyren.dev
            </p>
            <Input
              label="Website URL"
              type="url"
              value={formData.websiteUrl}
              onChange={(e) =>
                setFormData({ ...formData, websiteUrl: e.target.value })
              }
              placeholder="https://acme.com"
            />
            <Input
              label="Timezone"
              value={formData.timezone}
              onChange={(e) =>
                setFormData({ ...formData, timezone: e.target.value })
              }
              placeholder="UTC"
            />
          </div>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Logo URL"
              type="url"
              value={formData.logoUrl}
              onChange={(e) =>
                setFormData({ ...formData, logoUrl: e.target.value })
              }
              placeholder="https://example.com/logo.png"
            />
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">
                Brand Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.brandColor || "#f59e0b"}
                  onChange={(e) =>
                    setFormData({ ...formData, brandColor: e.target.value })
                  }
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <Input
                  value={formData.brandColor}
                  onChange={(e) =>
                    setFormData({ ...formData, brandColor: e.target.value })
                  }
                  placeholder="#f59e0b"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Custom Domain */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Domain</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <Input
              label="Custom Domain"
              value={formData.customDomain}
              onChange={(e) =>
                setFormData({ ...formData, customDomain: e.target.value })
              }
              placeholder="status.acme.com"
            />
            <p className="text-xs text-navy-400">
              Point a CNAME record to your Fyren status page subdomain.
            </p>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save Changes
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-sm text-navy-400">
            Deleting your organization will permanently remove all components,
            monitors, incidents, and subscriber data. This action cannot be
            undone.
          </p>
          <Button
            variant="danger"
            onClick={() =>
              alert("This feature is not implemented in this demo.")
            }
          >
            Delete Organization
          </Button>
        </div>
      </Card>
    </div>
  );
}
