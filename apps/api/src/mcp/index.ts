import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import type { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";

// Tool registrations
import { registerStatusTools } from "./tools/status";
import { registerComponentTools } from "./tools/components";
import { registerIncidentTools } from "./tools/incidents";
import { registerMonitorTools } from "./tools/monitors";
import { registerMaintenanceTools } from "./tools/maintenance";
import { registerSubscriberTools } from "./tools/subscribers";
import { registerWebhookTools } from "./tools/webhooks";

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "fyren",
    version: "0.1.0",
  });

  registerStatusTools(server);
  registerComponentTools(server);
  registerIncidentTools(server);
  registerMonitorTools(server);
  registerMaintenanceTools(server);
  registerSubscriberTools(server);
  registerWebhookTools(server);

  return server;
}

export function setupMcpRoutes(app: Hono) {
  // Protect MCP endpoint with API key auth
  app.use("/mcp", authMiddleware);
  app.use("/mcp/*", authMiddleware);

  // Handle all MCP requests (POST for JSON-RPC, GET for SSE, DELETE for session termination)
  app.all("/mcp", async (c) => {
    // Per-request server + transport to avoid concurrent transport conflicts
    const server = createMcpServer();
    const transport = new StreamableHTTPTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);

    try {
      const response = await transport.handleRequest(c);
      if (response) return response;
      return c.text("Accepted", 202);
    } finally {
      await transport.close();
      await server.close();
    }
  });
}
