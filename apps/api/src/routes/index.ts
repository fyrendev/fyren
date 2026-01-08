import { Hono } from "hono";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";
import { auth } from "../lib/auth";

// Public routes
import { publicOrganizations } from "./public/organizations";
import { publicComponents } from "./public/components";
import { publicStatus } from "./public/status";
import { publicInvites } from "./public/invites";
import { subscribeRoutes } from "./public/subscribe";
import { rssRoutes } from "./public/rss";
import { badgeRoutes } from "./public/badge";
import { widgetRoutes } from "./public/widget";
import { setupRoutes as publicSetupRoutes } from "./public/setup";

// Admin routes
import { adminOrganizations } from "./admin/organizations";
import { adminComponents } from "./admin/components";
import { adminApiKeys } from "./admin/api-keys";
import { adminMonitors } from "./admin/monitors";
import { adminMonitorResults } from "./admin/monitor-results";
import { adminUsers } from "./admin/users";
import { adminMembers } from "./admin/members";
import { adminInvites } from "./admin/invites";
import { adminIncidents } from "./admin/incidents";
import { adminIncidentTemplates } from "./admin/incident-templates";
import { adminMaintenance } from "./admin/maintenance";
import { adminSubscribers } from "./admin/subscribers";
import { subscriberGroupsRouter } from "./admin/subscriber-groups";
import { adminWebhooks } from "./admin/webhooks";

// Health routes
import { health } from "./health";

// Test routes (only enabled in dev/test)
import { testRoutes } from "./test";

export function setupRoutes(app: Hono) {
  // Health check routes (no auth)
  app.route("/health", health);

  // BetterAuth handles all /api/auth/* routes
  app.on(["POST", "GET", "OPTIONS"], "/api/auth/*", (c) => {
    return auth.handler(c.req.raw);
  });

  // Public routes (no auth)
  app.route("/api/v1/setup", publicSetupRoutes);
  app.route("/api/v1/org", publicOrganizations);
  app.route("/api/v1/org", publicComponents);
  app.route("/api/v1/status", publicStatus);
  app.route("/api/v1/status", subscribeRoutes);
  app.route("/api/v1/status", rssRoutes);
  app.route("/api/v1/status", badgeRoutes);
  app.route("/api/v1/status", widgetRoutes);
  app.route("/api/v1/invites", publicInvites);

  // Admin user routes (session only)
  app.route("/api/v1/admin", adminUsers);

  // Admin organization routes
  // Use optional auth for POST (no auth needed), required auth for GET/PUT
  app.use("/api/v1/admin/organizations", optionalAuthMiddleware);
  app.use("/api/v1/admin/organizations/*", optionalAuthMiddleware);
  app.route("/api/v1/admin/organizations", adminOrganizations);

  // Admin members routes (under organizations)
  app.route("/api/v1/admin/organizations", adminMembers);

  // Admin invites routes (under organizations)
  app.route("/api/v1/admin/organizations", adminInvites);

  // Protected component routes
  app.use("/api/v1/admin/components", authMiddleware);
  app.use("/api/v1/admin/components/*", authMiddleware);
  app.route("/api/v1/admin/components", adminComponents);

  // Protected API key routes
  app.use("/api/v1/admin/api-keys", authMiddleware);
  app.use("/api/v1/admin/api-keys/*", authMiddleware);
  app.route("/api/v1/admin/api-keys", adminApiKeys);

  // Protected monitor routes
  app.use("/api/v1/admin/monitors", authMiddleware);
  app.use("/api/v1/admin/monitors/*", authMiddleware);
  app.route("/api/v1/admin/monitors", adminMonitors);
  app.route("/api/v1/admin/monitors", adminMonitorResults);

  // Protected incident routes
  app.use("/api/v1/admin/incidents", authMiddleware);
  app.use("/api/v1/admin/incidents/*", authMiddleware);
  app.route("/api/v1/admin/incidents", adminIncidents);

  // Protected incident template routes
  app.use("/api/v1/admin/incident-templates", authMiddleware);
  app.use("/api/v1/admin/incident-templates/*", authMiddleware);
  app.route("/api/v1/admin/incident-templates", adminIncidentTemplates);

  // Protected maintenance routes
  app.use("/api/v1/admin/maintenance", authMiddleware);
  app.use("/api/v1/admin/maintenance/*", authMiddleware);
  app.route("/api/v1/admin/maintenance", adminMaintenance);

  // Protected subscriber routes
  app.use("/api/v1/admin/subscribers", authMiddleware);
  app.use("/api/v1/admin/subscribers/*", authMiddleware);
  app.route("/api/v1/admin/subscribers", adminSubscribers);

  // Protected subscriber group routes
  app.use("/api/v1/admin/subscriber-groups", authMiddleware);
  app.use("/api/v1/admin/subscriber-groups/*", authMiddleware);
  app.route("/api/v1/admin/subscriber-groups", subscriberGroupsRouter);

  // Protected webhook routes
  app.use("/api/v1/admin/webhooks", authMiddleware);
  app.use("/api/v1/admin/webhooks/*", authMiddleware);
  app.route("/api/v1/admin/webhooks", adminWebhooks);

  // Test routes (only enabled in dev/test environments)
  app.route("/api/v1/test", testRoutes);
}
