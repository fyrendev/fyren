"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { Menu, Bell, ChevronDown, LogOut, User } from "lucide-react";
import { MobileSidebar } from "@/components/admin/MobileSidebar";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Props {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export function AdminHeader({ user }: Props) {
  const { organization } = useOrganization();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/admin/login");
  }

  return (
    <>
      <header className="sticky top-0 z-40 h-16 bg-navy-900 border-b border-navy-800">
        <div className="flex items-center justify-between h-full px-6">
          {/* Mobile menu button */}
          <button
            className="lg:hidden p-2 text-navy-400 hover:text-white"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Organization name */}
          <div className="hidden lg:block">
            <h1 className="text-lg font-medium text-white">{organization?.name || "Loading..."}</h1>
          </div>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-navy-900 font-bold">F</span>
            </div>
            <span className="text-xl font-semibold text-white">Fyren</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button className="p-2 text-navy-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 p-2 text-navy-400 hover:text-white transition-colors"
              >
                <div className="w-8 h-8 bg-navy-700 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <span className="hidden sm:block text-sm">{user.name}</span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-navy-800 rounded-lg shadow-lg border border-navy-700 z-20">
                    <div className="px-4 py-3 border-b border-navy-700">
                      <p className="text-sm font-medium text-white">{user.name}</p>
                      <p className="text-xs text-navy-400">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-navy-400 hover:text-white hover:bg-navy-700 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  );
}
