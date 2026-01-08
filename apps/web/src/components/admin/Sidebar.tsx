"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Box,
  Activity,
  AlertTriangle,
  Wrench,
  Users,
  UsersRound,
  Webhook,
  Settings,
  Key,
  UserCog,
  ExternalLink,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Components", href: "/admin/components", icon: Box },
  { name: "Monitors", href: "/admin/monitors", icon: Activity },
  { name: "Incidents", href: "/admin/incidents", icon: AlertTriangle },
  { name: "Maintenance", href: "/admin/maintenance", icon: Wrench },
  { name: "Subscribers", href: "/admin/subscribers", icon: Users },
  { name: "Groups", href: "/admin/subscriber-groups", icon: UsersRound },
  { name: "Webhooks", href: "/admin/webhooks", icon: Webhook },
  { name: "API Keys", href: "/admin/api-keys", icon: Key },
  { name: "Team", href: "/admin/team", icon: UserCog },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-navy-900 border-r border-navy-800">
        {/* Logo */}
        <div className="flex items-center h-16 px-6 border-b border-navy-800">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-navy-900 font-bold">F</span>
            </div>
            <span className="text-xl font-semibold text-white">Fyren</span>
          </Link>
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
            href="/"
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
