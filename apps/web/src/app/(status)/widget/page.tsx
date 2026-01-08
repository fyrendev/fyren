import { notFound } from "next/navigation";
import { getStatus, getDefaultOrg } from "@/lib/api";

interface Props {
  searchParams: Promise<{ theme?: string; style?: string }>;
}

// Status indicator colors (matches StatusIndicator type)
const STATUS_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  operational: {
    bg: "bg-green-500/10",
    dot: "#22c55e",
    text: "text-green-700",
  },
  degraded_performance: {
    bg: "bg-yellow-500/10",
    dot: "#f59e0b",
    text: "text-yellow-700",
  },
  partial_outage: {
    bg: "bg-orange-500/10",
    dot: "#f97316",
    text: "text-orange-700",
  },
  major_outage: {
    bg: "bg-red-500/10",
    dot: "#ef4444",
    text: "text-red-700",
  },
  under_maintenance: {
    bg: "bg-blue-500/10",
    dot: "#3b82f6",
    text: "text-blue-700",
  },
};

export default async function WidgetPage({ searchParams }: Props) {
  const { theme = "light", style = "compact" } = await searchParams;

  let slug: string;
  try {
    const { organization } = await getDefaultOrg();
    slug = organization.slug;
  } catch {
    notFound();
  }

  let data;
  try {
    data = await getStatus(slug);
  } catch {
    notFound();
  }

  const statusColors = STATUS_COLORS[data.status.indicator] || STATUS_COLORS.operational;
  const isDark = theme === "dark";

  // Calculate component stats
  const totalComponents = data.components.length;
  const operationalCount = data.components.filter(
    (c: { status: string }) => c.status === "operational"
  ).length;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{data.organization.name} Status Widget</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: system-ui, -apple-system, sans-serif;
                background: ${isDark ? "#1e293b" : "transparent"};
                color: ${isDark ? "#f1f5f9" : "#1e293b"};
              }
              a { text-decoration: none; color: inherit; }
              .widget {
                padding: 12px 16px;
                border-radius: 8px;
                border: 1px solid ${isDark ? "#334155" : "#e2e8f0"};
                background: ${isDark ? "#1e293b" : "#ffffff"};
                transition: border-color 0.2s;
              }
              .widget:hover {
                border-color: ${isDark ? "#475569" : "#cbd5e1"};
              }
              .status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                animation: pulse 2s infinite;
              }
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              function sendHeight() {
                var height = document.body.scrollHeight;
                window.parent.postMessage(
                  JSON.stringify({ type: 'fyren-resize', slug: '${slug}', height: height }),
                  '*'
                );
              }
              window.onload = sendHeight;
              window.onresize = sendHeight;
            `,
          }}
        />
      </head>
      <body>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="widget"
          style={{ display: "block" }}
        >
          <div
            className="widget"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Status indicator */}
            <div
              className="status-dot"
              style={{
                backgroundColor: statusColors.dot,
                flexShrink: 0,
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "14px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {data.organization.name}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: isDark ? "#94a3b8" : "#64748b",
                  marginTop: "2px",
                }}
              >
                {data.status.description}
              </div>
            </div>

            {/* Component count (for compact/full styles) */}
            {style !== "minimal" && (
              <div
                style={{
                  fontSize: "12px",
                  color: isDark ? "#64748b" : "#94a3b8",
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {operationalCount}/{totalComponents} operational
              </div>
            )}
          </div>
        </a>
      </body>
    </html>
  );
}
