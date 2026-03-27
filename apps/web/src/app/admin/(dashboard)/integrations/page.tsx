"use client";

import { useEffect, useState, useRef } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";

type WidgetTheme = "light" | "dark";
type WidgetStyle = "minimal" | "compact" | "full";

export default function IntegrationsPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [widgetTheme, setWidgetTheme] = useState<WidgetTheme>("light");
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyle>("compact");
  const [appUrl, setAppUrl] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [iframeHeight, setIframeHeight] = useState(80);

  useEffect(() => {
    // Get the app URL from window.location in browser
    const url = window.location.origin;
    setAppUrl(url);

    // Listen for resize messages from the widget iframe
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (msg.type === "fyren-resize" && typeof msg.height === "number") {
          setIframeHeight(msg.height);
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const widgetScriptCode = `<script src="${appUrl}/api/v1/status/widget.js" async></script>`;
  const widgetContainerCode = `<div data-fyren-widget data-theme="${widgetTheme}" data-style="${widgetStyle}"></div>`;
  const widgetFullCode = `${widgetScriptCode}\n${widgetContainerCode}`;

  const badgeMarkdown = `[![Status](${appUrl}/api/v1/status/badge.svg)](${appUrl})`;
  const badgeHtml = `<a href="${appUrl}">
  <img src="${appUrl}/api/v1/status/badge.svg" alt="Status">
</a>`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Integrations</h1>
        <p className="text-navy-400 mt-1">
          Embed status widgets and badges on your website, README, or documentation.
        </p>
      </div>

      {/* Status Widget Section */}
      <Card>
        <CardHeader>
          <CardTitle>Status Widget</CardTitle>
        </CardHeader>
        <div className="space-y-6">
          <p className="text-sm text-navy-400">
            Add an embeddable status widget to your website. The widget automatically updates to
            reflect your current system status.
          </p>

          {/* Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Theme</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setWidgetTheme("light")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    widgetTheme === "light"
                      ? "bg-amber-500 text-navy-900"
                      : "bg-navy-700 text-navy-300 hover:bg-navy-600"
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setWidgetTheme("dark")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    widgetTheme === "dark"
                      ? "bg-amber-500 text-navy-900"
                      : "bg-navy-700 text-navy-300 hover:bg-navy-600"
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-2">Style</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setWidgetStyle("minimal")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    widgetStyle === "minimal"
                      ? "bg-amber-500 text-navy-900"
                      : "bg-navy-700 text-navy-300 hover:bg-navy-600"
                  }`}
                >
                  Minimal
                </button>
                <button
                  onClick={() => setWidgetStyle("compact")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    widgetStyle === "compact"
                      ? "bg-amber-500 text-navy-900"
                      : "bg-navy-700 text-navy-300 hover:bg-navy-600"
                  }`}
                >
                  Compact
                </button>
                <button
                  onClick={() => setWidgetStyle("full")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    widgetStyle === "full"
                      ? "bg-amber-500 text-navy-900"
                      : "bg-navy-700 text-navy-300 hover:bg-navy-600"
                  }`}
                >
                  Full
                </button>
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">Live Preview</label>
            <div
              className={`rounded-lg p-4 ${widgetTheme === "dark" ? "bg-slate-800" : "bg-white"}`}
            >
              {appUrl && (
                <iframe
                  ref={iframeRef}
                  src={`${appUrl}/widget?theme=${widgetTheme}&style=${widgetStyle}`}
                  style={{
                    width: "100%",
                    height: `${iframeHeight}px`,
                    border: "none",
                    overflow: "hidden",
                    transition: "height 0.2s ease",
                  }}
                  title="Status Widget Preview"
                  loading="lazy"
                />
              )}
            </div>
          </div>

          {/* Code Snippet */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-navy-300">Embed Code</label>
              <button
                onClick={() => copyToClipboard(widgetFullCode, "widget")}
                className="flex items-center gap-1 text-sm text-navy-400 hover:text-white transition-colors"
              >
                {copied === "widget" ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-navy-950 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div className="text-slate-400">{"<!-- Add the script to your page -->"}</div>
              <div className="text-emerald-400 mt-1">{widgetScriptCode}</div>
              <div className="text-slate-400 mt-3">
                {"<!-- Place the container where you want the widget -->"}
              </div>
              <div className="text-emerald-400 mt-1">{widgetContainerCode}</div>
            </div>
          </div>

          {/* Data Attributes Documentation */}
          <div className="bg-navy-700/30 rounded-lg p-4">
            <h4 className="text-sm font-medium text-navy-300 mb-3">Configuration Options</h4>
            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <code className="text-amber-400">data-theme</code>
                <span className="text-navy-400">
                  — Color theme: <code className="text-navy-300">&quot;light&quot;</code> or{" "}
                  <code className="text-navy-300">&quot;dark&quot;</code>
                </span>
              </div>
              <div className="flex gap-2">
                <code className="text-amber-400">data-style</code>
                <span className="text-navy-400">
                  — Widget style: <code className="text-navy-300">&quot;minimal&quot;</code>,{" "}
                  <code className="text-navy-300">&quot;compact&quot;</code>, or{" "}
                  <code className="text-navy-300">&quot;full&quot;</code>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Status Badge Section */}
      <Card>
        <CardHeader>
          <CardTitle>Status Badge</CardTitle>
        </CardHeader>
        <div className="space-y-6">
          <p className="text-sm text-navy-400">
            Add a status badge to your README, documentation, or website. The badge shows your
            current overall status and links to your status page.
          </p>

          {/* Badge Preview */}
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">Preview</label>
            <div className="bg-navy-700/30 rounded-lg p-4">
              {appUrl && (
                <a href={appUrl} target="_blank" rel="noopener noreferrer">
                  <img src={`${appUrl}/api/v1/status/badge.svg`} alt="Status" />
                </a>
              )}
            </div>
          </div>

          {/* Markdown Code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-navy-300">Markdown</label>
              <button
                onClick={() => copyToClipboard(badgeMarkdown, "badge-md")}
                className="flex items-center gap-1 text-sm text-navy-400 hover:text-white transition-colors"
              >
                {copied === "badge-md" ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-navy-950 rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <div className="text-emerald-400">{badgeMarkdown}</div>
            </div>
          </div>

          {/* HTML Code */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-navy-300">HTML</label>
              <button
                onClick={() => copyToClipboard(badgeHtml, "badge-html")}
                className="flex items-center gap-1 text-sm text-navy-400 hover:text-white transition-colors"
              >
                {copied === "badge-html" ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-navy-950 rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre">
              <span className="text-emerald-400">{badgeHtml}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* MCP (Model Context Protocol) Section */}
      <Card>
        <CardHeader>
          <CardTitle>MCP (Model Context Protocol)</CardTitle>
        </CardHeader>
        <div className="space-y-6">
          <p className="text-sm text-navy-400">
            Connect AI agents to Fyren using the Model Context Protocol. AI assistants can monitor
            status, create and resolve incidents, manage components, and more — all protected by
            your existing API keys.
          </p>

          {/* Endpoint */}
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-2">MCP Endpoint</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-navy-950 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <span className="text-emerald-400">{appUrl ? `${appUrl}/mcp` : "/mcp"}</span>
              </div>
              <button
                onClick={() => copyToClipboard(appUrl ? `${appUrl}/mcp` : "/mcp", "mcp-endpoint")}
                className="flex items-center gap-1 text-sm text-navy-400 hover:text-white transition-colors p-2"
              >
                {copied === "mcp-endpoint" ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Claude Code Configuration */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-navy-300">
                Claude Code Configuration
              </label>
              <button
                onClick={() =>
                  copyToClipboard(
                    JSON.stringify(
                      {
                        mcpServers: {
                          fyren: {
                            type: "url",
                            url: `${appUrl || "https://your-domain"}/mcp`,
                            headers: {
                              Authorization: "Bearer fyr_your_api_key_here",
                            },
                          },
                        },
                      },
                      null,
                      2
                    ),
                    "mcp-claude"
                  )
                }
                className="flex items-center gap-1 text-sm text-navy-400 hover:text-white transition-colors"
              >
                {copied === "mcp-claude" ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-navy-950 rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre text-emerald-400">
              {JSON.stringify(
                {
                  mcpServers: {
                    fyren: {
                      type: "url",
                      url: `${appUrl || "https://your-domain"}/mcp`,
                      headers: {
                        Authorization: "Bearer fyr_your_api_key_here",
                      },
                    },
                  },
                },
                null,
                2
              )}
            </div>
            <p className="text-xs text-navy-500 mt-2">
              Add this to your MCP client configuration. Replace the API key with a real key from{" "}
              <a href="/admin/api-keys" className="text-amber-400 hover:text-amber-300">
                API Keys
              </a>
              .
            </p>
          </div>

          {/* Scope Requirements */}
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-3">API Key Scopes</label>
            <div className="bg-navy-700/30 rounded-lg p-4">
              <p className="text-sm text-navy-400 mb-3">
                The API key scope determines which MCP tools are available:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-3 items-start">
                  <code className="text-amber-400 shrink-0 w-28">read</code>
                  <span className="text-navy-400">
                    View status, list components, incidents, monitors, maintenance, subscribers, and
                    webhooks.
                  </span>
                </div>
                <div className="flex gap-3 items-start">
                  <code className="text-amber-400 shrink-0 w-28">read-write</code>
                  <span className="text-navy-400">
                    Everything in read, plus create/update incidents, components, monitors,
                    maintenance, and webhooks. Resolve incidents, start/complete maintenance.
                  </span>
                </div>
                <div className="flex gap-3 items-start">
                  <code className="text-amber-400 shrink-0 w-28">full-access</code>
                  <span className="text-navy-400">
                    Everything in read-write, plus delete components, monitors, and webhooks.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Available Tools */}
          <div>
            <label className="block text-sm font-medium text-navy-300 mb-3">Available Tools</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { category: "Status", tools: ["get_status", "get_uptime"] },
                {
                  category: "Components",
                  tools: [
                    "list_components",
                    "get_component",
                    "create_component",
                    "update_component",
                    "update_component_status",
                    "delete_component",
                  ],
                },
                {
                  category: "Incidents",
                  tools: [
                    "list_incidents",
                    "get_incident",
                    "create_incident",
                    "update_incident",
                    "add_incident_update",
                    "resolve_incident",
                  ],
                },
                {
                  category: "Monitors",
                  tools: [
                    "list_monitors",
                    "get_monitor",
                    "create_monitor",
                    "update_monitor",
                    "delete_monitor",
                  ],
                },
                {
                  category: "Maintenance",
                  tools: [
                    "list_maintenance",
                    "get_maintenance",
                    "create_maintenance",
                    "update_maintenance",
                    "start_maintenance",
                    "complete_maintenance",
                    "cancel_maintenance",
                  ],
                },
                {
                  category: "Subscribers",
                  tools: ["list_subscribers", "remove_subscriber"],
                },
                {
                  category: "Webhooks",
                  tools: ["list_webhooks", "create_webhook", "update_webhook", "delete_webhook"],
                },
              ].map((group) => (
                <div key={group.category} className="bg-navy-800/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-white mb-2">{group.category}</h4>
                  <div className="flex flex-wrap gap-1">
                    {group.tools.map((tool) => (
                      <code
                        key={tool}
                        className="text-xs bg-navy-700 text-navy-300 px-1.5 py-0.5 rounded"
                      >
                        {tool}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href="/admin/api-keys"
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors px-4 py-2 text-sm bg-amber-500 text-navy-900 hover:bg-amber-400"
            >
              Create API Key
            </a>
          </div>
        </div>
      </Card>

      {/* API Documentation Link */}
      <Card>
        <CardHeader>
          <CardTitle>API Access</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <p className="text-sm text-navy-400">
            Use the Fyren API to programmatically access status data, create incidents, and manage
            your status page.
          </p>
          <div className="flex gap-3">
            <a
              href="/admin/api-keys"
              className="inline-flex items-center justify-center font-medium rounded-lg transition-colors px-4 py-2 text-sm bg-navy-800 text-white hover:bg-navy-700"
            >
              Manage API Keys
            </a>
            <a
              href={`${appUrl}/api/v1/status/embed.html`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 justify-center font-medium rounded-lg transition-colors px-4 py-2 text-sm text-navy-400 hover:text-white hover:bg-navy-800"
            >
              <ExternalLink className="w-4 h-4" />
              View Embed Page
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
