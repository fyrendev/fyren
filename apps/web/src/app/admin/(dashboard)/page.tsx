"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";
import { Badge } from "@/components/admin/ui/Badge";
import { api } from "@/lib/api-client";
import { Box, AlertTriangle, Wrench, Users } from "lucide-react";

interface DashboardStats {
  components: {
    total: number;
    operational: number;
    degraded: number;
    down: number;
  };
  incidents: { active: number; resolvedToday: number };
  maintenance: { upcoming: number; inProgress: number };
  subscribers: { total: number };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentIncidents, setRecentIncidents] = useState<
    Array<{
      id: string;
      title: string;
      status: string;
      createdAt: string;
      resolvedAt: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [componentsRes, incidentsRes, maintenancesRes, subscribersRes] =
          await Promise.all([
            api.getComponents().catch(() => ({ components: [] })),
            api.getIncidents("limit=5").catch(() => ({
              incidents: [],
              pagination: { total: 0, limit: 5, offset: 0 },
            })),
            api.getMaintenances("limit=5").catch(() => ({
              maintenances: [],
              pagination: { total: 0, limit: 5, offset: 0 },
            })),
            api.getSubscribers("limit=1").catch(() => ({
              subscribers: [],
              pagination: { total: 0, limit: 1, offset: 0 },
            })),
          ]);

        const components = componentsRes.components;
        const operational = components.filter(
          (c) => c.status === "operational"
        ).length;
        const degraded = components.filter(
          (c) => c.status === "degraded_performance" || c.status === "degraded"
        ).length;
        const down = components.filter(
          (c) =>
            c.status === "partial_outage" ||
            c.status === "major_outage" ||
            c.status === "maintenance"
        ).length;

        const incidents = incidentsRes.incidents;
        const activeIncidents = incidents.filter(
          (i) => !i.resolvedAt
        ).length;

        const maintenances = maintenancesRes.maintenances;
        const upcoming = maintenances.filter(
          (m) => m.status === "scheduled"
        ).length;
        const inProgress = maintenances.filter(
          (m) => m.status === "in_progress"
        ).length;

        setStats({
          components: {
            total: components.length,
            operational,
            degraded,
            down,
          },
          incidents: {
            active: activeIncidents,
            resolvedToday: incidents.length - activeIncidents,
          },
          maintenance: {
            upcoming,
            inProgress,
          },
          subscribers: {
            total: subscribersRes.pagination.total,
          },
        });

        setRecentIncidents(incidents.slice(0, 5));
      } catch (err) {
        console.error("Failed to load dashboard:", err);
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-navy-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Components"
          value={stats?.components.total || 0}
          icon={Box}
          subtitle={`${stats?.components.operational || 0} operational`}
          href="/admin/components"
        />
        <StatsCard
          title="Active Incidents"
          value={stats?.incidents.active || 0}
          icon={AlertTriangle}
          variant={stats?.incidents.active ? "danger" : "success"}
          subtitle={stats?.incidents.active ? "Needs attention" : "All clear"}
          href="/admin/incidents"
        />
        <StatsCard
          title="Maintenance"
          value={stats?.maintenance.upcoming || 0}
          icon={Wrench}
          subtitle={`${stats?.maintenance.inProgress || 0} in progress`}
          href="/admin/maintenance"
        />
        <StatsCard
          title="Subscribers"
          value={stats?.subscribers.total || 0}
          icon={Users}
          subtitle="Email subscribers"
          href="/admin/subscribers"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Incidents</CardTitle>
            <Link
              href="/admin/incidents"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View all
            </Link>
          </CardHeader>

          {recentIncidents.length === 0 ? (
            <p className="text-navy-400 text-sm">No recent incidents</p>
          ) : (
            <div className="space-y-3">
              {recentIncidents.map((incident) => (
                <Link
                  key={incident.id}
                  href={`/admin/incidents/${incident.id}`}
                  className="block p-3 bg-navy-800/50 rounded-lg hover:bg-navy-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {incident.title}
                      </p>
                      <p className="text-xs text-navy-400 mt-1">
                        {new Date(incident.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={incident.resolvedAt ? "success" : "danger"}
                    >
                      {incident.resolvedAt ? "Resolved" : incident.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>

          <div className="space-y-2">
            <Link
              href="/admin/incidents/new"
              className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg hover:bg-navy-800 transition-colors"
            >
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-white">Report an Incident</span>
            </Link>
            <Link
              href="/admin/maintenance/new"
              className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg hover:bg-navy-800 transition-colors"
            >
              <Wrench className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-white">Schedule Maintenance</span>
            </Link>
            <Link
              href="/admin/components"
              className="flex items-center gap-3 p-3 bg-navy-800/50 rounded-lg hover:bg-navy-800 transition-colors"
            >
              <Box className="w-5 h-5 text-green-400" />
              <span className="text-sm text-white">Manage Components</span>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  subtitle: string;
  href: string;
  variant?: "default" | "success" | "danger";
}

function StatsCard({
  title,
  value,
  icon: Icon,
  subtitle,
  href,
  variant = "default",
}: StatsCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:border-navy-700 transition-colors">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-navy-400">{title}</p>
            <p className="text-3xl font-semibold text-white mt-1">{value}</p>
            <p className="text-sm text-navy-500 mt-1">{subtitle}</p>
          </div>
          <div
            className={`p-3 rounded-lg ${
              variant === "danger"
                ? "bg-red-500/10"
                : variant === "success"
                  ? "bg-green-500/10"
                  : "bg-navy-800"
            }`}
          >
            <Icon
              className={`w-6 h-6 ${
                variant === "danger"
                  ? "text-red-400"
                  : variant === "success"
                    ? "text-green-400"
                    : "text-navy-400"
              }`}
            />
          </div>
        </div>
      </Card>
    </Link>
  );
}
