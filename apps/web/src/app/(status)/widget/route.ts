import { NextRequest, NextResponse } from "next/server";
import { getStatus } from "@/lib/api";

const STATUS_COLORS: Record<string, { dot: string }> = {
  operational: { dot: "#22c55e" },
  degraded_performance: { dot: "#f59e0b" },
  partial_outage: { dot: "#f97316" },
  major_outage: { dot: "#ef4444" },
  under_maintenance: { dot: "#3b82f6" },
};

const COMPONENT_STATUS_COLORS: Record<string, { dot: string; label: string }> = {
  operational: { dot: "#22c55e", label: "Operational" },
  degraded: { dot: "#f59e0b", label: "Degraded" },
  partial_outage: { dot: "#f97316", label: "Partial Outage" },
  major_outage: { dot: "#ef4444", label: "Major Outage" },
  maintenance: { dot: "#3b82f6", label: "Maintenance" },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const theme = searchParams.get("theme") || "light";
  const style = searchParams.get("style") || "compact";

  let data;
  try {
    data = await getStatus();
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }

  const statusColors = STATUS_COLORS[data.status.indicator] || STATUS_COLORS.operational;
  const isDark = theme === "dark";

  const totalComponents = data.components.length;
  const operationalCount = data.components.filter(
    (c: { status: string }) => c.status === "operational"
  ).length;

  const orgName = escapeHtml(data.organization.name);
  const statusDescription = escapeHtml(data.status.description);

  const componentCountHtml =
    style === "compact"
      ? `<div style="font-size:12px;color:${isDark ? "#64748b" : "#94a3b8"};text-align:right;flex-shrink:0">${operationalCount}/${totalComponents} operational</div>`
      : "";

  const componentListHtml =
    style === "full"
      ? `<div style="border-top:1px solid ${isDark ? "#334155" : "#e2e8f0"};margin-top:12px;padding-top:8px">
          ${data.components
            .map((c: { name: string; status: string }) => {
              const cs = COMPONENT_STATUS_COLORS[c.status] || COMPONENT_STATUS_COLORS.operational;
              return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">
              <span style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name)}</span>
              <span style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:12px">
                <span style="font-size:12px;color:${isDark ? "#94a3b8" : "#64748b"}">${cs.label}</span>
                <span style="width:8px;height:8px;border-radius:50%;background:${cs.dot};flex-shrink:0"></span>
              </span>
            </div>`;
            })
            .join("")}
        </div>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${orgName} Status Widget</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: ${isDark ? "#1e293b" : "transparent"};
      color: ${isDark ? "#f1f5f9" : "#1e293b"};
    }
    a { text-decoration: none; color: inherit; display: block; }
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
      flex-shrink: 0;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
  </style>
  <script>
    function sendHeight() {
      var height = document.body.scrollHeight;
      window.parent.postMessage(
        JSON.stringify({ type: 'fyren-resize', height: height }),
        '*'
      );
    }
    window.onload = sendHeight;
    window.onresize = sendHeight;
  </script>
</head>
<body>
  <a href="/" target="_blank" rel="noopener noreferrer" class="widget">
    <div style="display:flex;align-items:center;gap:12px">
      <div class="status-dot" style="background-color:${statusColors.dot}"></div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${orgName}</div>
        <div style="font-size:13px;color:${isDark ? "#94a3b8" : "#64748b"};margin-top:2px">${statusDescription}</div>
      </div>
      ${componentCountHtml}
    </div>
    ${componentListHtml}
  </a>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
