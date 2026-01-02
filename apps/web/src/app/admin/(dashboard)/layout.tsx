import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/admin/Sidebar";
import { AdminHeader } from "./AdminHeader";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { DashboardContent } from "@/components/admin/DashboardContent";

async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("better-auth.session_token");

  if (!sessionCookie) return null;

  const apiUrl = process.env.API_URL || "http://localhost:3001";

  try {
    const res = await fetch(`${apiUrl}/api/auth/get-session`, {
      headers: {
        Cookie: `better-auth.session_token=${sessionCookie.value}`,
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
