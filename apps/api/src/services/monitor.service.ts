import {
  db,
  monitors,
  monitorResults,
  components,
  organizations,
  eq,
  desc,
  and,
  sql,
  type ComponentStatus,
} from "@fyrendev/db";
import type { CheckResult } from "../lib/checkers";
import {
  cacheMonitorStatus,
  invalidateStatusCache,
  cacheUptime,
  getCachedUptime,
  type UptimeCache,
} from "./cache.service";

export interface StatusEvaluation {
  shouldUpdateComponent: boolean;
  newStatus: ComponentStatus;
  consecutiveFailures: number;
}

// Evaluate if component status should change based on recent results
export async function evaluateComponentStatus(
  monitorId: string,
  latestResult: CheckResult
): Promise<StatusEvaluation> {
  // Get the monitor with its failure threshold
  const [monitor] = await db
    .select()
    .from(monitors)
    .where(eq(monitors.id, monitorId))
    .limit(1);

  if (!monitor) {
    return {
      shouldUpdateComponent: false,
      newStatus: "operational",
      consecutiveFailures: 0,
    };
  }

  // Get the last N results where N = failureThreshold
  const recentResults = await db
    .select()
    .from(monitorResults)
    .where(eq(monitorResults.monitorId, monitorId))
    .orderBy(desc(monitorResults.checkedAt))
    .limit(monitor.failureThreshold);

  // Count consecutive failures from the most recent
  let consecutiveFailures = 0;
  for (const result of recentResults) {
    if (result.status === "down") {
      consecutiveFailures++;
    } else {
      break;
    }
  }

  // Get current component status
  const [component] = await db
    .select()
    .from(components)
    .where(eq(components.id, monitor.componentId))
    .limit(1);

  if (!component) {
    return {
      shouldUpdateComponent: false,
      newStatus: "operational",
      consecutiveFailures,
    };
  }

  const currentStatus = component.status as ComponentStatus;

  // Determine new status
  let newStatus: ComponentStatus = currentStatus;
  let shouldUpdateComponent = false;

  if (consecutiveFailures >= monitor.failureThreshold) {
    // All recent checks failed - major outage
    if (currentStatus !== "major_outage") {
      newStatus = "major_outage";
      shouldUpdateComponent = true;
    }
  } else if (consecutiveFailures > 0) {
    // Some checks failing but not all - degraded
    if (currentStatus === "operational") {
      newStatus = "degraded";
      shouldUpdateComponent = true;
    }
  } else if (latestResult.status === "up") {
    // Latest check passed - recovery check
    if (currentStatus === "major_outage" || currentStatus === "degraded") {
      // Check if we should recover - only if the previous check was also up
      // or if this is the only monitor for the component
      const otherMonitors = await db
        .select({ id: monitors.id, lastCheckedAt: monitors.lastCheckedAt })
        .from(monitors)
        .where(
          and(
            eq(monitors.componentId, monitor.componentId),
            eq(monitors.isActive, true)
          )
        );

      // If this is the only monitor or all monitors are passing, recover
      if (otherMonitors.length <= 1) {
        newStatus = "operational";
        shouldUpdateComponent = true;
      } else {
        // Check if any other monitor is currently down
        // For simplicity, we'll check the latest result for each monitor
        let allUp = true;
        for (const otherMonitor of otherMonitors) {
          if (otherMonitor.id === monitorId) continue;

          const [latestOtherResult] = await db
            .select()
            .from(monitorResults)
            .where(eq(monitorResults.monitorId, otherMonitor.id))
            .orderBy(desc(monitorResults.checkedAt))
            .limit(1);

          if (latestOtherResult && latestOtherResult.status === "down") {
            allUp = false;
            break;
          }
        }

        if (allUp) {
          newStatus = "operational";
          shouldUpdateComponent = true;
        }
      }
    }
  }

  return {
    shouldUpdateComponent,
    newStatus,
    consecutiveFailures,
  };
}

// Update component status in database
export async function updateComponentStatus(
  componentId: string,
  status: ComponentStatus
): Promise<void> {
  await db
    .update(components)
    .set({ status, updatedAt: new Date() })
    .where(eq(components.id, componentId));

  // Invalidate cache for the organization
  const [component] = await db
    .select({ organizationId: components.organizationId })
    .from(components)
    .where(eq(components.id, componentId))
    .limit(1);

  if (component) {
    const [org] = await db
      .select({ slug: organizations.slug })
      .from(organizations)
      .where(eq(organizations.id, component.organizationId))
      .limit(1);

    if (org) {
      await invalidateStatusCache(org.slug);
    }
  }
}

// Store check result and update monitor timestamp
export async function storeCheckResult(
  monitorId: string,
  result: CheckResult
): Promise<void> {
  // Store result
  await db.insert(monitorResults).values({
    monitorId,
    status: result.status,
    responseTimeMs: result.responseTimeMs,
    statusCode: result.statusCode,
    errorMessage: result.errorMessage,
  });

  // Update monitor last checked timestamp
  await db
    .update(monitors)
    .set({ lastCheckedAt: new Date() })
    .where(eq(monitors.id, monitorId));

  // Cache the current status
  await cacheMonitorStatus(monitorId, result.status, result.responseTimeMs);
}

// Calculate uptime for a component over a given period
export async function calculateUptime(
  componentId: string,
  period: "24h" | "7d" | "30d" | "90d"
): Promise<UptimeCache> {
  // Check cache first
  const cached = await getCachedUptime(componentId, period);
  if (cached) {
    return cached;
  }

  // Calculate the start date
  const now = new Date();
  const periodMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };

  const startDate = new Date(now.getTime() - periodMs[period]);

  // Get all monitors for this component
  const componentMonitors = await db
    .select({ id: monitors.id })
    .from(monitors)
    .where(eq(monitors.componentId, componentId));

  if (componentMonitors.length === 0) {
    const result: UptimeCache = {
      period,
      uptimePercentage: 100,
      totalChecks: 0,
      successfulChecks: 0,
      averageResponseTime: 0,
    };
    return result;
  }

  const monitorIds = componentMonitors.map((m) => m.id);

  // Query results for all monitors in the period
  const results = await db
    .select({
      totalChecks: sql<number>`count(*)::int`,
      successfulChecks: sql<number>`sum(case when ${monitorResults.status} = 'up' then 1 else 0 end)::int`,
      avgResponseTime: sql<number>`coalesce(avg(${monitorResults.responseTimeMs}), 0)::int`,
    })
    .from(monitorResults)
    .where(
      and(
        sql`${monitorResults.monitorId} = ANY(ARRAY[${sql.join(
          monitorIds.map((id) => sql`${id}::uuid`),
          sql`, `
        )}])`,
        sql`${monitorResults.checkedAt} >= ${startDate.toISOString()}::timestamp`
      )
    );

  const stats = results[0] || {
    totalChecks: 0,
    successfulChecks: 0,
    avgResponseTime: 0,
  };

  const uptimePercentage =
    stats.totalChecks > 0
      ? Math.round((stats.successfulChecks / stats.totalChecks) * 10000) / 100
      : 100;

  const result: UptimeCache = {
    period,
    uptimePercentage,
    totalChecks: stats.totalChecks,
    successfulChecks: stats.successfulChecks,
    averageResponseTime: stats.avgResponseTime,
  };

  // Cache the result
  await cacheUptime(componentId, period, result);

  return result;
}

// Get the overall status indicator for an organization
export function getOverallStatus(
  componentStatuses: ComponentStatus[]
): {
  indicator: ComponentStatus;
  description: string;
} {
  if (componentStatuses.length === 0) {
    return {
      indicator: "operational",
      description: "All systems operational",
    };
  }

  // Priority order: major_outage > partial_outage > degraded > maintenance > operational
  const statusPriority: ComponentStatus[] = [
    "major_outage",
    "partial_outage",
    "degraded",
    "maintenance",
    "operational",
  ];

  let worstStatus: ComponentStatus = "operational";

  for (const status of componentStatuses) {
    const currentPriority = statusPriority.indexOf(status);
    const worstPriority = statusPriority.indexOf(worstStatus);

    if (currentPriority !== -1 && currentPriority < worstPriority) {
      worstStatus = status;
    }
  }

  const descriptions: Record<ComponentStatus, string> = {
    operational: "All systems operational",
    degraded: "Some systems experiencing degraded performance",
    partial_outage: "Some systems experiencing partial outage",
    major_outage: "Major system outage",
    maintenance: "Scheduled maintenance in progress",
  };

  return {
    indicator: worstStatus,
    description: descriptions[worstStatus],
  };
}
