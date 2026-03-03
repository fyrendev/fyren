import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getStatus, getUptime, getSetupStatus } from "@/lib/api";

export const dynamic = "force-dynamic";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";
import { StatusBanner } from "@/components/status/StatusBanner";
import { ComponentList } from "@/components/status/ComponentList";
import { IncidentList } from "@/components/incidents/IncidentList";
import { MaintenanceCard } from "@/components/maintenance/MaintenanceCard";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrganizationTheme } from "@/components/status/ThemeProvider";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const setupStatus = await getSetupStatus();
    if (setupStatus.needsSetup) {
      return { title: "Setup Required" };
    }

    const data = await getStatus();
    return {
      title: `${data.organization.name} Status`,
      description: `Current status: ${data.status.description}`,
      openGraph: {
        title: `${data.organization.name} Status`,
        description: data.status.description,
      },
    };
  } catch {
    return { title: "Status Page" };
  }
}

export default async function StatusPage() {
  // Check if setup is needed
  const setupStatus = await getSetupStatus();
  if (setupStatus.needsSetup) {
    redirect("/setup");
  }

  let data;
  let uptime;

  try {
    [data, uptime] = await Promise.all([getStatus(), getUptime()]);
  } catch {
    notFound();
  }

  return (
    <OrganizationTheme organization={data.organization}>
      {/* Client component for auto-refresh */}
      <AutoRefresh interval={60000} />

      <div className="min-h-screen status-page-bg">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Header organization={data.organization} />

          <StatusBanner
            indicator={data.status.indicator}
            description={data.status.description}
            brandColor={data.organization.brandColor}
          />

          {/* Active Incidents */}
          {data.activeIncidents.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Active Incidents</h2>
              <IncidentList incidents={data.activeIncidents} />
            </section>
          )}

          {/* Scheduled Maintenance */}
          {data.scheduledMaintenance.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Scheduled Maintenance</h2>
              <div className="space-y-4">
                {data.scheduledMaintenance.map((m) => (
                  <MaintenanceCard key={m.id} maintenance={m} />
                ))}
              </div>
            </section>
          )}

          {/* Components */}
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Components</h2>
              <span className="text-sm theme-muted">
                {uptime.overall.month.toFixed(2)}% uptime this month
              </span>
            </div>
            <ComponentList components={data.components} uptimeData={uptime.components} />
          </section>

          {/* Past Incidents Link */}
          <section className="mt-8">
            <Link href="/incidents" className="brand-link transition-colors">
              View incident history →
            </Link>
          </section>

          {/* Subscribe */}
          <section className="mt-12">
            <SubscribeForm />
          </section>

          <Footer organization={data.organization} rssUrl="/api/v1/status/rss" />
        </div>
      </div>
    </OrganizationTheme>
  );
}
