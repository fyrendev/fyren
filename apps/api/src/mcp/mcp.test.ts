import { describe, test, expect } from "bun:test";
import {
  createTestApp,
  setupTestHooks,
  createTestApiKey,
  createTestOrganization,
  createTestComponent,
  createTestIncident,
  createTestIncidentUpdate,
  createTestMaintenance,
  createTestWebhook,
  createTestSubscriber,
} from "../test";

describe("MCP Server", () => {
  setupTestHooks();

  const app = createTestApp();

  /**
   * Send an MCP JSON-RPC request to /mcp.
   */
  async function mcpRequest(
    method: string,
    params: Record<string, unknown> = {},
    apiKey: string,
    id: number = 1
  ) {
    return app.request("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      }),
    });
  }

  /**
   * Initialize an MCP session and return the response.
   */
  async function mcpInitialize(apiKey: string) {
    return mcpRequest(
      "initialize",
      {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "0.1.0" },
      },
      apiKey
    );
  }

  /**
   * Call an MCP tool and parse the JSON result from the text content.
   */
  async function mcpCallTool(toolName: string, args: Record<string, unknown>, apiKey: string) {
    const res = await mcpRequest("tools/call", { name: toolName, arguments: args }, apiKey);
    return res;
  }

  /**
   * Parse an MCP JSON response body.
   */
  async function parseMcpResponse(res: Response) {
    return (await res.json()) as Record<string, unknown>;
  }

  /**
   * Parse the text content from an MCP tool call result.
   */
  function parseToolResult(result: Record<string, unknown>): {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
    parsed: Record<string, any>;
  } {
    const content = result.result as {
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    };
    if (!content?.content?.[0]?.text) return { ...content, parsed: {} };
    try {
      return {
        ...content,
        parsed: JSON.parse(content.content[0].text),
      };
    } catch {
      return { ...content, parsed: {} };
    }
  }

  // ── Authentication ──────────────────────────────────────────────

  describe("Authentication", () => {
    test("rejects unauthenticated requests", async () => {
      const res = await app.request("/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "test", version: "0.1.0" },
          },
        }),
      });

      expect(res.status).toBe(401);
    });

    test("accepts valid API key", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await mcpInitialize(rawKey);
      expect(res.status).toBe(200);
    });

    test("read scope key cannot call write tools", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read" });

      const res = await mcpCallTool("create_component", { name: "Test Component" }, rawKey);

      const body = await parseMcpResponse(res);
      // MCP SDK catches tool errors and returns them in result.content with isError flag
      const result = body.result as { content: Array<{ text: string }>; isError?: boolean };
      // The error may be in result.content or body.error depending on SDK behavior
      const hasError =
        result?.isError === true ||
        result?.content?.[0]?.text?.includes("Insufficient scope") ||
        (body.error as { message?: string })?.message?.includes("scope");
      expect(hasError).toBe(true);
    });

    test("read-write scope key can call write tools", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read-write" });

      const res = await mcpCallTool("create_component", { name: "Test Component" }, rawKey);

      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);
      expect(result.isError).toBeFalsy();
    });

    test("read-write scope key cannot call full-access tools", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read-write" });
      const component = await createTestComponent();

      const res = await mcpCallTool("delete_component", { id: component.id }, rawKey);

      const body = await parseMcpResponse(res);
      const result = body.result as { content: Array<{ text: string }>; isError?: boolean };
      const hasError =
        result?.isError === true ||
        result?.content?.[0]?.text?.includes("Insufficient scope") ||
        (body.error as { message?: string })?.message?.includes("scope");
      expect(hasError).toBe(true);
    });

    test("full-access scope key can call delete tools", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "full-access" });
      const component = await createTestComponent();

      const res = await mcpCallTool("delete_component", { id: component.id }, rawKey);

      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);
      expect(result.isError).toBeFalsy();
    });
  });

  // ── Scope Isolation ──────────────────────────────────────────────
  // Verify that every write/delete tool is blocked at the correct scope level.

  describe("Scope Isolation", () => {
    /**
     * Assert that calling a tool returns a scope error.
     */
    async function expectScopeError(
      toolName: string,
      args: Record<string, unknown>,
      apiKey: string
    ) {
      const res = await mcpCallTool(toolName, args, apiKey);
      const body = await parseMcpResponse(res);
      const result = body.result as
        | { content: Array<{ text: string }>; isError?: boolean }
        | undefined;
      const errorMsg = (body.error as { message?: string })?.message;
      const contentText = result?.content?.[0]?.text || "";
      const hasScopeError =
        (result?.isError === true && contentText.includes("Insufficient scope")) ||
        errorMsg?.includes("scope");
      expect(hasScopeError).toBe(true);
    }

    /**
     * Assert that calling a tool succeeds (no scope error).
     */
    async function expectNoScopeError(
      toolName: string,
      args: Record<string, unknown>,
      apiKey: string
    ) {
      const res = await mcpCallTool(toolName, args, apiKey);
      const body = await parseMcpResponse(res);
      const result = body.result as
        | { content: Array<{ text: string }>; isError?: boolean }
        | undefined;
      const contentText = result?.content?.[0]?.text || "";
      const hasScopeError = contentText.includes("Insufficient scope");
      expect(hasScopeError).toBe(false);
    }

    // ── read scope: blocked from all write tools ──

    describe("read scope cannot call read-write tools", () => {
      test("create_incident", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectScopeError(
          "create_incident",
          {
            title: "Test",
            message: "Test",
            severity: "minor",
          },
          rawKey
        );
      });

      test("update_incident", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const incident = await createTestIncident();
        await expectScopeError(
          "update_incident",
          {
            id: incident.id,
            title: "Updated",
          },
          rawKey
        );
      });

      test("add_incident_update", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const incident = await createTestIncident();
        await createTestIncidentUpdate(incident.id);
        await expectScopeError(
          "add_incident_update",
          {
            id: incident.id,
            status: "identified",
            message: "Update",
          },
          rawKey
        );
      });

      test("resolve_incident", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const incident = await createTestIncident();
        await createTestIncidentUpdate(incident.id);
        await expectScopeError(
          "resolve_incident",
          {
            id: incident.id,
          },
          rawKey
        );
      });

      test("create_component", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectScopeError("create_component", { name: "Test" }, rawKey);
      });

      test("update_component", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const comp = await createTestComponent();
        await expectScopeError("update_component", { id: comp.id, name: "X" }, rawKey);
      });

      test("update_component_status", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const comp = await createTestComponent();
        await expectScopeError(
          "update_component_status",
          {
            id: comp.id,
            status: "degraded",
          },
          rawKey
        );
      });

      test("create_monitor", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const comp = await createTestComponent();
        await expectScopeError(
          "create_monitor",
          {
            componentId: comp.id,
            type: "http",
            url: "https://example.com",
          },
          rawKey
        );
      });

      test("update_monitor", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectScopeError(
          "update_monitor",
          {
            id: "00000000-0000-0000-0000-000000000000",
            isActive: false,
          },
          rawKey
        );
      });

      test("create_maintenance", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const comp = await createTestComponent();
        const start = new Date(Date.now() + 86400000).toISOString();
        const end = new Date(Date.now() + 90000000).toISOString();
        await expectScopeError(
          "create_maintenance",
          {
            title: "Test",
            scheduledStartAt: start,
            scheduledEndAt: end,
            componentIds: [comp.id],
          },
          rawKey
        );
      });

      test("start_maintenance", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const maint = await createTestMaintenance();
        await expectScopeError("start_maintenance", { id: maint.id }, rawKey);
      });

      test("complete_maintenance", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const maint = await createTestMaintenance({ status: "in_progress" });
        await expectScopeError("complete_maintenance", { id: maint.id }, rawKey);
      });

      test("cancel_maintenance", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const maint = await createTestMaintenance();
        await expectScopeError("cancel_maintenance", { id: maint.id }, rawKey);
      });

      test("remove_subscriber", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const sub = await createTestSubscriber();
        await expectScopeError("remove_subscriber", { id: sub.id }, rawKey);
      });

      test("create_webhook", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectScopeError(
          "create_webhook",
          {
            name: "Test",
            type: "generic",
            url: "https://example.com/hook",
          },
          rawKey
        );
      });

      test("update_webhook", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const webhook = await createTestWebhook();
        await expectScopeError(
          "update_webhook",
          {
            id: webhook.id,
            name: "Updated",
          },
          rawKey
        );
      });
    });

    // ── read scope: allowed for all read tools ──

    describe("read scope can call read tools", () => {
      test("get_status", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("get_status", {}, rawKey);
      });

      test("get_uptime", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("get_uptime", {}, rawKey);
      });

      test("list_components", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("list_components", {}, rawKey);
      });

      test("list_incidents", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("list_incidents", {}, rawKey);
      });

      test("list_monitors", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("list_monitors", {}, rawKey);
      });

      test("list_maintenance", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("list_maintenance", {}, rawKey);
      });

      test("list_subscribers", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("list_subscribers", {}, rawKey);
      });

      test("list_webhooks", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        await expectNoScopeError("list_webhooks", {}, rawKey);
      });

      test("get_component", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const comp = await createTestComponent();
        await expectNoScopeError("get_component", { id: comp.id }, rawKey);
      });

      test("get_incident", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read" });
        const incident = await createTestIncident();
        await createTestIncidentUpdate(incident.id);
        await expectNoScopeError("get_incident", { id: incident.id }, rawKey);
      });
    });

    // ── read-write scope: blocked from full-access tools ──

    describe("read-write scope cannot call full-access tools", () => {
      test("delete_component", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read-write" });
        const comp = await createTestComponent();
        await expectScopeError("delete_component", { id: comp.id }, rawKey);
      });

      test("delete_monitor", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read-write" });
        await expectScopeError(
          "delete_monitor",
          {
            id: "00000000-0000-0000-0000-000000000000",
          },
          rawKey
        );
      });

      test("delete_webhook", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read-write" });
        const webhook = await createTestWebhook();
        await expectScopeError("delete_webhook", { id: webhook.id }, rawKey);
      });

      test("cancel_maintenance", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "read-write" });
        const maint = await createTestMaintenance();
        await expectScopeError("cancel_maintenance", { id: maint.id }, rawKey);
      });
    });

    // ── full-access scope: can call all tools ──

    describe("full-access scope can call delete tools", () => {
      test("delete_component", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "full-access" });
        const comp = await createTestComponent();
        await expectNoScopeError("delete_component", { id: comp.id }, rawKey);
      });

      test("delete_webhook", async () => {
        await createTestOrganization();
        const { rawKey } = await createTestApiKey({ scope: "full-access" });
        const webhook = await createTestWebhook();
        await expectNoScopeError("delete_webhook", { id: webhook.id }, rawKey);
      });
    });
  });

  // ── Protocol ────────────────────────────────────────────────────

  describe("Protocol", () => {
    test("initialize returns server info", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await mcpInitialize(rawKey);
      const body = await parseMcpResponse(res);

      expect(body.jsonrpc).toBe("2.0");
      const result = body.result as Record<string, unknown>;
      expect(result.serverInfo).toBeDefined();
      const serverInfo = result.serverInfo as { name: string };
      expect(serverInfo.name).toBe("fyren");
    });

    test("tools/list returns all registered tools", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();

      const res = await mcpRequest("tools/list", {}, rawKey);
      const body = await parseMcpResponse(res);

      const result = body.result as { tools: Array<{ name: string }> };
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);

      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("get_status");
      expect(toolNames).toContain("create_incident");
      expect(toolNames).toContain("list_components");
      expect(toolNames).toContain("list_monitors");
      expect(toolNames).toContain("list_maintenance");
      expect(toolNames).toContain("list_subscribers");
      expect(toolNames).toContain("list_webhooks");
    });
  });

  // ── Status Tools ────────────────────────────────────────────────

  describe("Status Tools", () => {
    test("get_status returns status summary", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestComponent({ name: "API", status: "operational" });
      await createTestComponent({ name: "DB", status: "degraded" });

      const res = await mcpCallTool("get_status", {}, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.components).toHaveLength(2);
      expect(result.parsed.status).toBeDefined();
    });

    test("get_uptime returns uptime data", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestComponent({ name: "API" });

      const res = await mcpCallTool("get_uptime", { period: "24h" }, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.period).toBe("24h");
      expect(result.parsed.components).toBeDefined();
    });
  });

  // ── Component Tools ─────────────────────────────────────────────

  describe("Component Tools", () => {
    test("list_components returns all components", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestComponent({ name: "API" });
      await createTestComponent({ name: "DB" });

      const res = await mcpCallTool("list_components", {}, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.components).toHaveLength(2);
    });

    test("create_component creates a new component", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read-write" });

      const res = await mcpCallTool(
        "create_component",
        { name: "New Service", description: "A new service" },
        rawKey
      );
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.name).toBe("New Service");
      expect(result.parsed.status).toBe("operational");
    });

    test("update_component_status changes component status", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read-write" });
      const component = await createTestComponent();

      const res = await mcpCallTool(
        "update_component_status",
        { id: component.id, status: "degraded" },
        rawKey
      );
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.status).toBe("degraded");
    });
  });

  // ── Incident Tools ──────────────────────────────────────────────

  describe("Incident Tools", () => {
    test("list_incidents returns incidents", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestIncident({ title: "API Down" });

      const res = await mcpCallTool("list_incidents", {}, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.incidents).toHaveLength(1);
      expect(result.parsed.incidents[0].title).toBe("API Down");
    });

    test("create_incident creates a new incident", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read-write" });
      const component = await createTestComponent();

      const res = await mcpCallTool(
        "create_incident",
        {
          title: "Service Outage",
          severity: "major",
          message: "Investigating service degradation",
          componentIds: [component.id],
        },
        rawKey
      );
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.title).toBe("Service Outage");
      expect(result.parsed.severity).toBe("major");
    });

    test("resolve_incident resolves an incident", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read-write" });
      const incident = await createTestIncident();
      await createTestIncidentUpdate(incident.id);

      const res = await mcpCallTool(
        "resolve_incident",
        { id: incident.id, message: "Issue has been resolved" },
        rawKey
      );
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.status).toBe("resolved");
    });
  });

  // ── Maintenance Tools ───────────────────────────────────────────

  describe("Maintenance Tools", () => {
    test("list_maintenance returns maintenance windows", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestMaintenance({ title: "DB Migration" });

      const res = await mcpCallTool("list_maintenance", {}, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.maintenances).toHaveLength(1);
      expect(result.parsed.maintenances[0].title).toBe("DB Migration");
    });
  });

  // ── Subscriber Tools ────────────────────────────────────────────

  describe("Subscriber Tools", () => {
    test("list_subscribers returns subscribers", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestSubscriber({ email: "test@example.com" });

      const res = await mcpCallTool("list_subscribers", {}, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.subscribers).toHaveLength(1);
      expect(result.parsed.subscribers[0].email).toBe("test@example.com");
    });

    test("remove_subscriber deletes a subscriber", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey({ scope: "read-write" });
      const subscriber = await createTestSubscriber();

      const res = await mcpCallTool("remove_subscriber", { id: subscriber.id }, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.isError).toBeFalsy();
    });
  });

  // ── Webhook Tools ───────────────────────────────────────────────

  describe("Webhook Tools", () => {
    test("list_webhooks returns webhooks", async () => {
      await createTestOrganization();
      const { rawKey } = await createTestApiKey();
      await createTestWebhook({ name: "Slack Alert" });

      const res = await mcpCallTool("list_webhooks", {}, rawKey);
      const body = await parseMcpResponse(res);
      const result = parseToolResult(body);

      expect(result.parsed.webhooks).toHaveLength(1);
      expect(result.parsed.webhooks[0].name).toBe("Slack Alert");
    });
  });
});
