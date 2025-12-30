import type { UptimeData } from "@/lib/types";

interface Props {
  uptime: UptimeData;
}

export function UptimeStats({ uptime }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4 text-center">
      <div>
        <div className="text-2xl font-bold">{uptime.day.toFixed(2)}%</div>
        <div className="text-sm text-navy-400">24 hours</div>
      </div>
      <div>
        <div className="text-2xl font-bold">{uptime.week.toFixed(2)}%</div>
        <div className="text-sm text-navy-400">7 days</div>
      </div>
      <div>
        <div className="text-2xl font-bold">{uptime.month.toFixed(2)}%</div>
        <div className="text-sm text-navy-400">30 days</div>
      </div>
      <div>
        <div className="text-2xl font-bold">{uptime.quarter.toFixed(2)}%</div>
        <div className="text-sm text-navy-400">90 days</div>
      </div>
    </div>
  );
}
