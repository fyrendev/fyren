"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationContextValue {
  organization: Organization | null;
  loading: boolean;
  error: string | null;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganization = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch user info");
      }

      const data = await res.json();
      const org = data.organization || null;
      setOrganization(org);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch organization:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch organization");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        loading,
        error,
        refreshOrganization: fetchOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}
