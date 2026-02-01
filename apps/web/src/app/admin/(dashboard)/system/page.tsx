"use client";

import { useEffect, useState } from "react";
import {
  api,
  type LogProvider,
  type LogLevel,
  type LokiConfigInput,
  type OtlpConfigInput,
} from "@/lib/api-client";
import { Button } from "@/components/admin/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";

export default function SystemPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAndApplying, setSavingAndApplying] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [currentSource, setCurrentSource] = useState<"env" | "database">("env");
  const [currentProvider, setCurrentProvider] = useState<string>("console");

  const [formData, setFormData] = useState<{
    logProvider: LogProvider;
    logLevel: LogLevel;
    logServiceName: string;
    lokiUrl: string;
    lokiConfig: LokiConfigInput;
    otlpEndpoint: string;
    otlpConfig: OtlpConfigInput;
  }>({
    logProvider: "console",
    logLevel: "info",
    logServiceName: "fyren-api",
    lokiUrl: "",
    lokiConfig: {
      username: "",
      password: "",
      tenantId: "",
    },
    otlpEndpoint: "",
    otlpConfig: {
      headers: {},
    },
  });

  const [otlpHeaderKey, setOtlpHeaderKey] = useState("");
  const [otlpHeaderValue, setOtlpHeaderValue] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await api.getLoggingConfig();
      setCurrentSource(data.currentSource);
      setCurrentProvider(data.currentProvider);

      setFormData({
        logProvider: data.config.logProvider,
        logLevel: data.config.logLevel,
        logServiceName: data.config.logServiceName,
        lokiUrl: data.config.lokiUrl || "",
        lokiConfig: {
          username: "",
          password: "",
          tenantId: "",
        },
        otlpEndpoint: data.config.otlpEndpoint || "",
        otlpConfig: {
          headers: {},
        },
      });
    } catch (err) {
      console.error("Failed to load logging config:", err);
      setError("Failed to load logging configuration");
    } finally {
      setLoading(false);
    }
  }

  function buildLoggingInput() {
    const input: {
      logProvider: LogProvider;
      logLevel: LogLevel;
      logServiceName?: string;
      lokiUrl?: string | null;
      lokiConfig?: LokiConfigInput | null;
      otlpEndpoint?: string | null;
      otlpConfig?: OtlpConfigInput | null;
    } = {
      logProvider: formData.logProvider,
      logLevel: formData.logLevel,
      logServiceName: formData.logServiceName,
    };

    // Add Loki config if using Loki
    if (formData.logProvider === "loki") {
      input.lokiUrl = formData.lokiUrl || null;
      const lokiHasSecrets =
        formData.lokiConfig.username ||
        formData.lokiConfig.password ||
        formData.lokiConfig.tenantId;
      input.lokiConfig = lokiHasSecrets
        ? {
            username: formData.lokiConfig.username || undefined,
            password: formData.lokiConfig.password || undefined,
            tenantId: formData.lokiConfig.tenantId || undefined,
          }
        : null;
    } else {
      input.lokiUrl = null;
      input.lokiConfig = null;
    }

    // Add OTLP config if using OTLP
    if (formData.logProvider === "otlp") {
      input.otlpEndpoint = formData.otlpEndpoint || null;
      const hasHeaders =
        formData.otlpConfig.headers && Object.keys(formData.otlpConfig.headers).length > 0;
      input.otlpConfig = hasHeaders ? { headers: formData.otlpConfig.headers } : null;
    } else {
      input.otlpEndpoint = null;
      input.otlpConfig = null;
    }

    return input;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const input = buildLoggingInput();
      const result = await api.updateLoggingConfig(input);
      setSuccess(result.message);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update logging configuration";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndApply(e: React.FormEvent) {
    e.preventDefault();
    setSavingAndApplying(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);

    try {
      const input = buildLoggingInput();
      await api.updateLoggingConfig(input);

      // Immediately reload the logger
      const reloadResult = await api.reloadLoggingConfig();
      setCurrentSource(reloadResult.source as "env" | "database");
      setCurrentProvider(reloadResult.provider);
      setSuccess(`Configuration saved and applied. Now using ${reloadResult.provider} provider.`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save and apply configuration";
      setError(message);
    } finally {
      setSavingAndApplying(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    try {
      const result = await api.testLoggingConfig();
      setTestResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to test logging configuration";
      setTestResult({ success: false, message });
    } finally {
      setTesting(false);
    }
  }

  async function handleReload() {
    setReloading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await api.reloadLoggingConfig();
      setSuccess(result.message);
      setCurrentSource(result.source as "env" | "database");
      setCurrentProvider(result.provider);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reload logging configuration";
      setError(message);
    } finally {
      setReloading(false);
    }
  }

  async function handleReset() {
    setReloading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await api.resetLoggingConfig();
      setSuccess(result.message);
      setCurrentSource("env");
      setCurrentProvider(result.provider);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset logging configuration";
      setError(message);
    } finally {
      setReloading(false);
    }
  }

  function addOtlpHeader() {
    if (otlpHeaderKey && otlpHeaderValue) {
      setFormData({
        ...formData,
        otlpConfig: {
          ...formData.otlpConfig,
          headers: {
            ...formData.otlpConfig.headers,
            [otlpHeaderKey]: otlpHeaderValue,
          },
        },
      });
      setOtlpHeaderKey("");
      setOtlpHeaderValue("");
    }
  }

  function removeOtlpHeader(key: string) {
    const newHeaders = { ...formData.otlpConfig.headers };
    delete newHeaders[key];
    setFormData({
      ...formData,
      otlpConfig: {
        ...formData.otlpConfig,
        headers: newHeaders,
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
      <h1 className="text-2xl font-semibold text-white">System Settings</h1>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {success}
        </div>
      )}

      {/* Current Status */}
      <Card>
        <CardHeader>
          <CardTitle>Current Status</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-navy-400">Active Provider:</span>
            <span className="px-2 py-1 bg-navy-700 rounded text-sm text-white font-mono">
              {currentProvider}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-navy-400">Configuration Source:</span>
            <span
              className={`px-2 py-1 rounded text-sm ${
                currentSource === "database"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}
            >
              {currentSource === "database" ? "Database" : "Environment Variables"}
            </span>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" onClick={handleReload} loading={reloading}>
              Apply Database Config
            </Button>
            <Button variant="secondary" onClick={handleReset} loading={reloading}>
              Reset to Env Config
            </Button>
          </div>
        </div>
      </Card>

      {/* Logging Configuration */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Logging Configuration</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <p className="text-sm text-navy-400">
              Configure where logs are sent. Use &quot;Save &amp; Apply&quot; to immediately
              activate your changes, or &quot;Save Only&quot; to save without applying.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1">Log Provider</label>
                <select
                  value={formData.logProvider}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      logProvider: e.target.value as LogProvider,
                    })
                  }
                  className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="console">Console (stdout)</option>
                  <option value="loki">Grafana Loki</option>
                  <option value="otlp">OTLP (OpenTelemetry)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-navy-300 mb-1">Log Level</label>
                <select
                  value={formData.logLevel}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      logLevel: e.target.value as LogLevel,
                    })
                  }
                  className="w-full px-3 py-2 bg-navy-700 border border-navy-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>

            <Input
              label="Service Name"
              value={formData.logServiceName}
              onChange={(e) => setFormData({ ...formData, logServiceName: e.target.value })}
              placeholder="fyren-api"
            />

            {/* Loki Configuration */}
            {formData.logProvider === "loki" && (
              <div className="space-y-4 p-4 bg-navy-700/30 rounded-lg">
                <h4 className="text-sm font-medium text-navy-300">Grafana Loki Configuration</h4>
                <Input
                  label="Loki URL"
                  type="url"
                  value={formData.lokiUrl}
                  onChange={(e) => setFormData({ ...formData, lokiUrl: e.target.value })}
                  placeholder="https://logs-prod-us-central1.grafana.net"
                  required
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Username (optional)"
                    value={formData.lokiConfig.username || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lokiConfig: { ...formData.lokiConfig, username: e.target.value },
                      })
                    }
                    placeholder="username"
                  />
                  <Input
                    label="Password (optional)"
                    type="password"
                    value={formData.lokiConfig.password || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        lokiConfig: { ...formData.lokiConfig, password: e.target.value },
                      })
                    }
                    placeholder="password or API key"
                  />
                </div>
                <Input
                  label="Tenant ID (optional)"
                  value={formData.lokiConfig.tenantId || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lokiConfig: { ...formData.lokiConfig, tenantId: e.target.value },
                    })
                  }
                  placeholder="tenant-id"
                />
                <p className="text-xs text-navy-400">
                  Leave credentials empty if your Loki instance doesn&apos;t require authentication.
                </p>
              </div>
            )}

            {/* OTLP Configuration */}
            {formData.logProvider === "otlp" && (
              <div className="space-y-4 p-4 bg-navy-700/30 rounded-lg">
                <h4 className="text-sm font-medium text-navy-300">OTLP Configuration</h4>
                <Input
                  label="OTLP Endpoint"
                  type="url"
                  value={formData.otlpEndpoint}
                  onChange={(e) => setFormData({ ...formData, otlpEndpoint: e.target.value })}
                  placeholder="https://otlp.example.com/v1/logs"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-navy-300 mb-2">
                    Custom Headers
                  </label>
                  {Object.entries(formData.otlpConfig.headers || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 mb-2 p-2 bg-navy-700 rounded">
                      <span className="text-sm text-navy-300 font-mono">{key}:</span>
                      <span className="text-sm text-white font-mono flex-1">
                        {key.toLowerCase().includes("key") ||
                        key.toLowerCase().includes("secret") ||
                        key.toLowerCase().includes("token")
                          ? "********"
                          : value}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOtlpHeader(key)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={otlpHeaderKey}
                      onChange={(e) => setOtlpHeaderKey(e.target.value)}
                      placeholder="Header name"
                      className="flex-1"
                    />
                    <Input
                      value={otlpHeaderValue}
                      onChange={(e) => setOtlpHeaderValue(e.target.value)}
                      placeholder="Header value"
                      className="flex-1"
                    />
                    <Button type="button" variant="secondary" onClick={addOtlpHeader}>
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-navy-400 mt-2">
                    Add authentication headers like Authorization or x-api-key.
                  </p>
                </div>
              </div>
            )}

            {/* Console Info */}
            {formData.logProvider === "console" && (
              <div className="p-3 bg-navy-700/50 rounded-lg">
                <p className="text-sm text-navy-400">
                  Console logging outputs JSON-formatted logs to stdout. This is the default and
                  requires no additional configuration.
                </p>
              </div>
            )}

            {testResult && (
              <div
                className={`p-3 rounded-lg ${
                  testResult.success
                    ? "bg-green-500/10 border border-green-500/20 text-green-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}
              >
                {testResult.message}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button type="button" variant="secondary" onClick={handleTest} loading={testing}>
                Test Configuration
              </Button>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="secondary"
                  loading={saving}
                  disabled={savingAndApplying}
                >
                  Save Only
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveAndApply}
                  loading={savingAndApplying}
                  disabled={saving}
                >
                  Save & Apply
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </form>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>About Logging Configuration</CardTitle>
        </CardHeader>
        <div className="space-y-3 text-sm text-navy-400">
          <p>
            <strong className="text-navy-300">Console:</strong> Logs are written to stdout in JSON
            format. Ideal for development or when using container log aggregation.
          </p>
          <p>
            <strong className="text-navy-300">Grafana Loki:</strong> Push logs directly to a Loki
            instance. Great for Grafana-based observability stacks.
          </p>
          <p>
            <strong className="text-navy-300">OTLP:</strong> OpenTelemetry Protocol for sending logs
            to any OTLP-compatible backend (Grafana, Datadog, etc.).
          </p>
          <p className="text-amber-400/80">
            Note: Environment variables (LOG_PROVIDER, LOG_LEVEL, etc.) are used as fallback when no
            database configuration exists.
          </p>
        </div>
      </Card>
    </div>
  );
}
