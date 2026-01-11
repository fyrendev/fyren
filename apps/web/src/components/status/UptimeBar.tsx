"use client";

import { useEffect, useState } from "react";
import type { UptimeHistory } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  componentId: string;
  slug: string;
}

const colors: Record<string, string> = {
  operational: "bg-green-500",
  degraded_performance: "bg-yellow-500",
  partial_outage: "bg-orange-500",
  major_outage: "bg-red-500",
  under_maintenance: "bg-blue-500",
};

export function UptimeBar({ componentId, slug }: Props) {
  const [history, setHistory] = useState<UptimeHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredDay, setHoveredDay] = useState<UptimeHistory | null>(null);

  useEffect(() => {
    fetch(`/api/v1/status/${slug}/uptime/${componentId}/history?days=90`)
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [componentId, slug]);

  if (loading) {
    return (
      <div className="h-8 rounded animate-pulse" style={{ backgroundColor: "var(--input-bg)" }} />
    );
  }

  if (history.length === 0) {
    return (
      <div
        className="h-8 rounded flex items-center justify-center text-sm theme-muted"
        style={{ backgroundColor: "var(--input-bg)" }}
      >
        No data available
      </div>
    );
  }

  // Reverse to show oldest first (left to right)
  const reversedHistory = [...history].reverse();

  return (
    <div className="relative">
      <div className="flex gap-0.5">
        {reversedHistory.map((day) => (
          <div
            key={day.date}
            className={cn(
              "flex-1 h-8 rounded-sm cursor-pointer transition-opacity hover:opacity-80",
              colors[day.status] || "bg-green-500"
            )}
            onMouseEnter={() => setHoveredDay(day)}
            onMouseLeave={() => setHoveredDay(null)}
          />
        ))}
      </div>
      {hoveredDay && (
        <div
          className="absolute -top-10 left-1/2 transform -translate-x-1/2 text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10"
          style={{ backgroundColor: "var(--card-bg)", color: "var(--text-color)" }}
        >
          {hoveredDay.date}: {hoveredDay.uptime.toFixed(2)}% uptime
        </div>
      )}
    </div>
  );
}
