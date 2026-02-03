"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface OrganizationContextValue {
  organization: Organization | null;
  organizations: Organization[];
  loading: boolean;
  setOrganization: (org: Organization) => void;
  refreshOrganizations: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

const ORG_STORAGE_KEY = "fyren_current_org_id";

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organization, setOrganizationState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/admin/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to fetch user info");
      }

      const data = await res.json();
      const orgs: Organization[] = data.organizations || [];
      setOrganizations(orgs);

      // Try to restore saved org or use first one
      const savedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
      const savedOrg = orgs.find((o) => o.id === savedOrgId);

      if (savedOrg) {
        setOrganizationState(savedOrg);
      } else if (orgs.length > 0) {
        setOrganizationState(orgs[0]);
        localStorage.setItem(ORG_STORAGE_KEY, orgs[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  const setOrganization = useCallback((org: Organization) => {
    setOrganizationState(org);
    localStorage.setItem(ORG_STORAGE_KEY, org.id);
  }, []);

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizations,
        loading,
        setOrganization,
        refreshOrganizations: fetchOrganizations,
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

// Export the current org ID for use in API client
export function getCurrentOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORG_STORAGE_KEY);
}
