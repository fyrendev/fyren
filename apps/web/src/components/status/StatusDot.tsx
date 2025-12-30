import type { ComponentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  status: ComponentStatus | string;
  size?: "sm" | "md";
}

const colors: Record<string, string> = {
  operational: "bg-green-500",
  degraded: "bg-yellow-500",
  degraded_performance: "bg-yellow-500",
  partial_outage: "bg-orange-500",
  major_outage: "bg-red-500",
  maintenance: "bg-blue-500",
  under_maintenance: "bg-blue-500",
};

export function StatusDot({ status, size = "md" }: Props) {
  return (
    <span
      className={cn(
        "rounded-full inline-block",
        colors[status] || "bg-gray-500",
        size === "sm" ? "w-2 h-2" : "w-3 h-3"
      )}
    />
  );
}
