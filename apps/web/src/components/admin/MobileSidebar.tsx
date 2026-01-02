"use client";

import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  Box,
  ExternalLink,
  Key,
  LayoutDashboard,
  Settings,
  UserCog,
  Users,
  Webhook,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOrganization } from "@/contexts/OrganizationContext";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Components", href: "/admin/components", icon: Box },
  { name: "Monitors", href: "/admin/monitors", icon: Activity },
  { name: "Incidents", href: "/admin/incidents", icon: AlertTriangle },
  { name: "Maintenance", href: "/admin/maintenance", icon: Wrench },
  { name: "Subscribers", href: "/admin/subscribers", icon: Users },
  { name: "Webhooks", href: "/admin/webhooks", icon: Webhook },
  { name: "API Keys", href: "/admin/api-keys", icon: Key },
  { name: "Team", href: "/admin/team", icon: UserCog },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSidebar({ isOpen, onClose }: Props) {
  const pathname = usePathname();
  const { organization } = useOrganization();

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-navy-900 border-r border-navy-800">
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-navy-800">
          <Link href="/admin" className="flex items-center gap-2" onClick={onClose}>
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-navy-900 font-bold">F</span>
            </div>
            <span className="text-xl font-semibold text-white">Fyren</span>
          </Link>
          <button onClick={onClose} className="p-2 text-navy-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-navy-800 text-white"
                    : "text-navy-400 hover:text-white hover:bg-navy-800/50"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* View Status Page Link */}
        <div className="p-3 border-t border-navy-800">
          <Link
            href={organization ? `/${organization.slug}` : "/"}
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 text-sm text-navy-400 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Status Page
          </Link>
        </div>
      </div>
    </div>
  );
}
