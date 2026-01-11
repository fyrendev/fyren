import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getIncidents, getStatus, getDefaultOrg } from "@/lib/api";
import { IncidentList } from "@/components/incidents/IncidentList";
import { OrganizationTheme } from "@/components/status/ThemeProvider";

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { organization } = await getDefaultOrg();
    const data = await getStatus(organization.slug);
    return {
      title: `Incident History | ${data.organization.name} Status`,
      description: `Past incidents and status updates for ${data.organization.name}`,
    };
  } catch {
    return { title: "Incident History" };
  }
}

export default async function IncidentsPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;
  const page = parseInt(pageParam || "1", 10);
  const limit = 10;
  const offset = (page - 1) * limit;

  let org;
  try {
    const { organization } = await getDefaultOrg();
    org = organization;
  } catch {
    notFound();
  }

  const slug = org.slug;

  let incidents;
  let pagination;

  try {
    const data = await getIncidents(slug, {
      limit,
      offset,
      status: "all",
    });
    incidents = data.incidents;
    pagination = data.pagination;
  } catch {
    notFound();
  }

  const totalPages = Math.ceil(pagination.total / limit);

  return (
    <OrganizationTheme organization={org}>
      <div className="min-h-screen status-page-bg">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/" className="inline-flex items-center gap-2 brand-link mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to status
          </Link>

          <h1 className="text-2xl font-semibold mb-6">Incident History</h1>

          {incidents.length === 0 ? (
            <p className="theme-muted">No incidents to display.</p>
          ) : (
            <>
              <IncidentList incidents={incidents} slug={slug} />

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {page > 1 && (
                    <Link
                      href={`/incidents?page=${page - 1}`}
                      className="px-4 py-2 rounded transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "var(--card-bg)" }}
                    >
                      Previous
                    </Link>
                  )}
                  <span className="px-4 py-2 theme-muted">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={`/incidents?page=${page + 1}`}
                      className="px-4 py-2 rounded transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "var(--card-bg)" }}
                    >
                      Next
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </OrganizationTheme>
  );
}
