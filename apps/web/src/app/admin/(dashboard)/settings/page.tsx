"use client";

import { useEffect, useState } from "react";
import {
  api,
  type Organization,
  type EmailProvider,
  type SMTPConfig,
  type SendGridConfig,
  type SESConfig,
  type EmailConfig,
} from "@/lib/api-client";
import { Button } from "@/components/admin/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";

export default function SettingsPage() {
  const [_organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    faviconUrl: "",
    brandColor: "",
    accentColor: "",
    backgroundColor: "",
    textColor: "",
    customDomain: "",
    timezone: "",
  });

  const [emailFormData, setEmailFormData] = useState<{
    emailProvider: EmailProvider;
    emailFromAddress: string;
    smtpConfig: SMTPConfig;
    sendgridConfig: SendGridConfig;
    sesConfig: SESConfig;
  }>({
    emailProvider: "console",
    emailFromAddress: "",
    smtpConfig: {
      host: "",
      port: 587,
      user: "",
      password: "",
      secure: true,
    },
    sendgridConfig: {
      apiKey: "",
    },
    sesConfig: {
      region: "us-east-1",
      accessKeyId: "",
      secretAccessKey: "",
    },
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
        logoUrl: data.organization.logoUrl || "",
        faviconUrl: data.organization.faviconUrl || "",
        brandColor: data.organization.brandColor || "",
        accentColor: data.organization.accentColor || "",
        backgroundColor: data.organization.backgroundColor || "",
        textColor: data.organization.textColor || "",
        customDomain: data.organization.customDomain || "",
        timezone: data.organization.timezone || "UTC",
      });
      setEmailFormData((prev) => ({
        ...prev,
        emailProvider: data.organization.emailProvider || "console",
        emailFromAddress: data.organization.emailFromAddress || "",
      }));
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
      const message = err instanceof Error ? err.message : "Failed to update settings";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    setTestEmailResult(null);

    try {
      let emailConfig: EmailConfig | null = null;

      // Only include config if not console provider
      if (emailFormData.emailProvider === "smtp") {
        emailConfig = emailFormData.smtpConfig;
      } else if (emailFormData.emailProvider === "sendgrid") {
        emailConfig = emailFormData.sendgridConfig;
      } else if (emailFormData.emailProvider === "ses") {
        emailConfig = emailFormData.sesConfig;
      }

      await api.updateOrganization({
        emailProvider: emailFormData.emailProvider,
        emailFromAddress: emailFormData.emailFromAddress || null,
        emailConfig,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update email settings";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTestEmail() {
    setTestingEmail(true);
    setTestEmailResult(null);

    try {
      const result = await api.testEmail();
      setTestEmailResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send test email";
      setTestEmailResult({ success: false, message });
    } finally {
      setTestingEmail(false);
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Acme Inc"
              required
            />
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="acme"
              required
            />
            <p className="text-xs text-navy-400">Your status page URL: {formData.slug}.fyren.dev</p>
            <Input
              label="Timezone"
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
            <Input
              label="Favicon URL"
              type="url"
              value={formData.faviconUrl}
              onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
              placeholder="https://example.com/favicon.ico"
            />
            <p className="text-xs text-navy-400">
              If not set, the logo URL will be used as the favicon.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1">Brand Color</label>
                <p className="text-xs text-navy-400 mb-2">
                  Primary color for buttons, links, and accents
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.brandColor || "#f59e0b"}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                    placeholder="#f59e0b"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1">Accent Color</label>
                <p className="text-xs text-navy-400 mb-2">Secondary color for highlights</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.accentColor || "#3b82f6"}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.accentColor}
                    onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                    placeholder="#3b82f6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1">
                  Background Color
                </label>
                <p className="text-xs text-navy-400 mb-2">Status page background</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.backgroundColor || "#0a1628"}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.backgroundColor}
                    onChange={(e) => setFormData({ ...formData, backgroundColor: e.target.value })}
                    placeholder="#0a1628"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1">Text Color</label>
                <p className="text-xs text-navy-400 mb-2">Main text color</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.textColor || "#ffffff"}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer"
                  />
                  <Input
                    value={formData.textColor}
                    onChange={(e) => setFormData({ ...formData, textColor: e.target.value })}
                    placeholder="#ffffff"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  brandColor: "#f59e0b",
                  accentColor: "#3b82f6",
                  backgroundColor: "#0a1628",
                  textColor: "#ffffff",
                })
              }
              className="text-sm text-navy-400 hover:text-white transition-colors"
            >
              Reset colors to defaults
            </button>
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
              onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
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

      {/* Email Configuration - Separate form */}
      <form onSubmit={handleEmailSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Email Configuration</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <p className="text-sm text-navy-400">
              Configure how notification emails are sent to your subscribers.
            </p>

            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">Email Provider</label>
              <select
                value={emailFormData.emailProvider}
                onChange={(e) =>
                  setEmailFormData({
                    ...emailFormData,
                    emailProvider: e.target.value as EmailProvider,
                  })
                }
                className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                <option value="console">Console (Development only)</option>
                <option value="smtp">SMTP</option>
                <option value="sendgrid">SendGrid</option>
                <option value="ses">Amazon SES</option>
              </select>
            </div>

            {emailFormData.emailProvider === "console" && (
              <div className="p-3 bg-navy-700/50 rounded-lg">
                <p className="text-sm text-navy-400">
                  Console provider is for development only. Emails will be logged to the server
                  console instead of being sent.
                </p>
              </div>
            )}

            {emailFormData.emailProvider !== "console" && (
              <Input
                label="From Email Address"
                type="email"
                value={emailFormData.emailFromAddress}
                onChange={(e) =>
                  setEmailFormData({ ...emailFormData, emailFromAddress: e.target.value })
                }
                placeholder="notifications@yourcompany.com"
                required
              />
            )}

            {emailFormData.emailProvider === "smtp" && (
              <div className="space-y-4 p-4 bg-navy-700/30 rounded-lg">
                <h4 className="text-sm font-medium text-navy-300">SMTP Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="SMTP Host"
                    value={emailFormData.smtpConfig.host}
                    onChange={(e) =>
                      setEmailFormData({
                        ...emailFormData,
                        smtpConfig: { ...emailFormData.smtpConfig, host: e.target.value },
                      })
                    }
                    placeholder="smtp.example.com"
                    required
                  />
                  <Input
                    label="Port"
                    type="number"
                    value={emailFormData.smtpConfig.port}
                    onChange={(e) =>
                      setEmailFormData({
                        ...emailFormData,
                        smtpConfig: {
                          ...emailFormData.smtpConfig,
                          port: parseInt(e.target.value) || 587,
                        },
                      })
                    }
                    placeholder="587"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Username"
                    value={emailFormData.smtpConfig.user || ""}
                    onChange={(e) =>
                      setEmailFormData({
                        ...emailFormData,
                        smtpConfig: { ...emailFormData.smtpConfig, user: e.target.value },
                      })
                    }
                    placeholder="username"
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={emailFormData.smtpConfig.password || ""}
                    onChange={(e) =>
                      setEmailFormData({
                        ...emailFormData,
                        smtpConfig: { ...emailFormData.smtpConfig, password: e.target.value },
                      })
                    }
                    placeholder="password"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="smtp-secure"
                    checked={emailFormData.smtpConfig.secure}
                    onChange={(e) =>
                      setEmailFormData({
                        ...emailFormData,
                        smtpConfig: { ...emailFormData.smtpConfig, secure: e.target.checked },
                      })
                    }
                    className="w-4 h-4 rounded border-navy-600 bg-navy-700 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="smtp-secure" className="text-sm text-navy-300">
                    Use TLS/SSL
                  </label>
                </div>
              </div>
            )}

            {emailFormData.emailProvider === "sendgrid" && (
              <div className="space-y-4 p-4 bg-navy-700/30 rounded-lg">
                <h4 className="text-sm font-medium text-navy-300">SendGrid Configuration</h4>
                <Input
                  label="API Key"
                  type="password"
                  value={emailFormData.sendgridConfig.apiKey}
                  onChange={(e) =>
                    setEmailFormData({
                      ...emailFormData,
                      sendgridConfig: { apiKey: e.target.value },
                    })
                  }
                  placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                />
              </div>
            )}

            {emailFormData.emailProvider === "ses" && (
              <div className="space-y-4 p-4 bg-navy-700/30 rounded-lg">
                <h4 className="text-sm font-medium text-navy-300">Amazon SES Configuration</h4>
                <Input
                  label="AWS Region"
                  value={emailFormData.sesConfig.region}
                  onChange={(e) =>
                    setEmailFormData({
                      ...emailFormData,
                      sesConfig: { ...emailFormData.sesConfig, region: e.target.value },
                    })
                  }
                  placeholder="us-east-1"
                  required
                />
                <Input
                  label="Access Key ID"
                  value={emailFormData.sesConfig.accessKeyId}
                  onChange={(e) =>
                    setEmailFormData({
                      ...emailFormData,
                      sesConfig: { ...emailFormData.sesConfig, accessKeyId: e.target.value },
                    })
                  }
                  placeholder="AKIAXXXXXXXXXXXXXXXX"
                  required
                />
                <Input
                  label="Secret Access Key"
                  type="password"
                  value={emailFormData.sesConfig.secretAccessKey}
                  onChange={(e) =>
                    setEmailFormData({
                      ...emailFormData,
                      sesConfig: { ...emailFormData.sesConfig, secretAccessKey: e.target.value },
                    })
                  }
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                />
              </div>
            )}

            {testEmailResult && (
              <div
                className={`p-3 rounded-lg ${
                  testEmailResult.success
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}
              >
                {testEmailResult.message}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestEmail}
                loading={testingEmail}
              >
                Send Test Email
              </Button>
              <Button type="submit" loading={saving}>
                Save Email Settings
              </Button>
            </div>
          </div>
        </Card>
      </form>

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-sm text-navy-400">
            Deleting your organization will permanently remove all components, monitors, incidents,
            and subscriber data. This action cannot be undone.
          </p>
          <Button
            variant="danger"
            onClick={() => alert("This feature is not implemented in this demo.")}
          >
            Delete Organization
          </Button>
        </div>
      </Card>
    </div>
  );
}
