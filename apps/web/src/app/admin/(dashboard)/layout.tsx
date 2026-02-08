import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminHeader } from "./AdminHeader";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { DashboardContent } from "@/components/admin/DashboardContent";
import { request } from "@/lib/request";

async function getSession() {
  const cookieStore = await cookies();
  // BetterAuth prefixes cookies with __Secure- when secure: true (e.g. when COOKIE_DOMAIN is set)
  const sessionCookie =
    cookieStore.get("better-auth.session_token") ??
    cookieStore.get("__Secure-better-auth.session_token");

  if (!sessionCookie) return null;

  try {
    const res = await request("/api/auth/get-session", {
      headers: {
        Cookie: `${sessionCookie.name}=${sessionCookie.value}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/admin/login");
  }

  return (
    <OrganizationProvider>
      <div className="min-h-screen bg-navy-950">
        <Sidebar />
        <div className="lg:pl-64">
          <AdminHeader user={session.user} />
          <DashboardContent>{children}</DashboardContent>
        </div>
      </div>
    </OrganizationProvider>
  );
}
