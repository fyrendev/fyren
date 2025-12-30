import type { StatusIndicator } from "@/lib/types";
import { CheckCircle, AlertTriangle, XCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  indicator: StatusIndicator;
  description: string;
}

const config: Record<
  StatusIndicator,
  {
    bg: string;
    icon: typeof CheckCircle;
    text: string;
  }
> = {
  operational: {
    bg: "bg-green-500",
    icon: CheckCircle,
    text: "text-green-50",
  },
  degraded_performance: {
    bg: "bg-yellow-500",
    icon: AlertTriangle,
    text: "text-yellow-50",
  },
  partial_outage: {
    bg: "bg-orange-500",
    icon: AlertTriangle,
    text: "text-orange-50",
  },
  major_outage: {
    bg: "bg-red-500",
    icon: XCircle,
    text: "text-red-50",
  },
  under_maintenance: {
    bg: "bg-blue-500",
    icon: Wrench,
    text: "text-blue-50",
  },
};

export function StatusBanner({ indicator, description }: Props) {
  const { bg, icon: Icon, text } = config[indicator];

  return (
    <div className={cn("rounded-lg p-6 mt-6", bg)}>
      <div className="flex items-center gap-3">
        <Icon className={cn("w-8 h-8", text)} />
        <span className={cn("text-xl font-semibold", text)}>{description}</span>
      </div>
    </div>
  );
}
