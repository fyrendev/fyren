import { redis } from "../lib/redis";
import type { Component, ComponentStatus } from "@fyrendev/db";

// Cache key generators
const COMPONENT_STATUS_KEY = (orgSlug: string) => `status:${orgSlug}:components`;
const MONITOR_STATUS_KEY = (monitorId: string) => `monitor:${monitorId}:status`;
const UPTIME_KEY = (componentId: string, period: string) =>
  `uptime:${componentId}:${period}`;

// TTL values in seconds
const STATUS_TTL = 60; // 1 minute
const UPTIME_TTL = 300; // 5 minutes

export interface ComponentWithStatus {
  id: string;
  name: string;
  description: string | null;
  status: ComponentStatus;
  displayOrder: number;
  updatedAt: Date;
}

export interface MonitorStatusCache {
  status: "up" | "down";
  responseTimeMs: number;
  lastCheckedAt: string;
}

export interface UptimeCache {
  period: "24h" | "7d" | "30d" | "90d";
  uptimePercentage: number;
  totalChecks: number;
  successfulChecks: number;
  averageResponseTime: number;
}

// Cache current component statuses for an organization
export async function cacheComponentStatus(
  orgSlug: string,
  components: ComponentWithStatus[]
): Promise<void> {
  const key = COMPONENT_STATUS_KEY(orgSlug);
  await redis.setex(key, STATUS_TTL, JSON.stringify(components));
}

// Get cached component status
export async function getCachedComponentStatus(
  orgSlug: string
): Promise<ComponentWithStatus[] | null> {
  const key = COMPONENT_STATUS_KEY(orgSlug);
  const data = await redis.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as ComponentWithStatus[];
  } catch {
    return null;
  }
}

// Cache individual monitor status
export async function cacheMonitorStatus(
  monitorId: string,
  status: "up" | "down",
  responseTimeMs: number
): Promise<void> {
  const key = MONITOR_STATUS_KEY(monitorId);
  const cache: MonitorStatusCache = {
    status,
    responseTimeMs,
    lastCheckedAt: new Date().toISOString(),
  };
  await redis.setex(key, STATUS_TTL, JSON.stringify(cache));
}

// Get cached monitor status
export async function getCachedMonitorStatus(
  monitorId: string
): Promise<MonitorStatusCache | null> {
  const key = MONITOR_STATUS_KEY(monitorId);
  const data = await redis.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as MonitorStatusCache;
  } catch {
    return null;
  }
}

// Cache uptime stats
export async function cacheUptime(
  componentId: string,
  period: "24h" | "7d" | "30d" | "90d",
  stats: UptimeCache
): Promise<void> {
  const key = UPTIME_KEY(componentId, period);
  await redis.setex(key, UPTIME_TTL, JSON.stringify(stats));
}

// Get cached uptime stats
export async function getCachedUptime(
  componentId: string,
  period: "24h" | "7d" | "30d" | "90d"
): Promise<UptimeCache | null> {
  const key = UPTIME_KEY(componentId, period);
  const data = await redis.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as UptimeCache;
  } catch {
    return null;
  }
}

// Invalidate status cache for an organization
export async function invalidateStatusCache(orgSlug: string): Promise<void> {
  const key = COMPONENT_STATUS_KEY(orgSlug);
  await redis.del(key);
}

// Invalidate all uptime caches for a component
export async function invalidateUptimeCache(componentId: string): Promise<void> {
  const periods: Array<"24h" | "7d" | "30d" | "90d"> = ["24h", "7d", "30d", "90d"];
  const keys = periods.map((p) => UPTIME_KEY(componentId, p));
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

// Invalidate all caches for an organization (used when status changes)
export async function invalidateOrgCaches(
  orgSlug: string,
  componentIds: string[]
): Promise<void> {
  await invalidateStatusCache(orgSlug);
  for (const componentId of componentIds) {
    await invalidateUptimeCache(componentId);
  }
}
