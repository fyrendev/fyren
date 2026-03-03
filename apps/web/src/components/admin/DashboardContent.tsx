"use client";

import { useOrganization } from "@/contexts/OrganizationContext";

interface Props {
  children: React.ReactNode;
}

export function DashboardContent({ children }: Props) {
  const { organization, loading } = useOrganization();

  if (loading) {
    return (
      <main className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-navy-400">Loading...</div>
        </div>
      </main>
    );
  }

  if (!organization) {
    return (
      <main className="p-6">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="text-navy-400">No organization found</div>
        </div>
      </main>
    );
  }

  return <main className="p-6">{children}</main>;
}
