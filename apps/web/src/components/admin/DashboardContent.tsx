"use client";

import Link from "next/link";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Props {
  children: React.ReactNode;
}

export function DashboardContent({ children }: Props) {
  const { organization, organizations, loading } = useOrganization();

  if (loading) {
    return (
      <main className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-navy-400">Loading...</div>
        </div>
      </main>
    );
  }

  if (!organization && organizations.length === 0) {
    return (
      <main className="p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-navy-400">No organization found</div>
          <Link
            href="/admin/organizations/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Organization
          </Link>
        </div>
      </main>
    );
  }

  return <main className="p-6">{children}</main>;
}
