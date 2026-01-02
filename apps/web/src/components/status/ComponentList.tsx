import type { Component, ComponentUptime } from "@/lib/types";
import { ComponentRow } from "./ComponentRow";

interface Props {
  components: Component[];
  uptimeData: ComponentUptime[];
  slug: string;
}

export function ComponentList({ components, uptimeData, slug }: Props) {
  // Group by group field
  const grouped = components.reduce(
    (acc, component) => {
      const group = component.group || "default";
      if (!acc[group]) acc[group] = [];
      acc[group].push(component);
      return acc;
    },
    {} as Record<string, Component[]>
  );

  const uptimeMap = new Map(uptimeData.map((u) => [u.id, u.uptime]));

  return (
    <div className="bg-navy-900 rounded-lg border border-navy-800 overflow-hidden">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          {group !== "default" && (
            <div className="px-4 py-2 bg-navy-800 text-sm font-medium text-navy-300">{group}</div>
          )}
          {items
            .sort((a, b) => a.order - b.order)
            .map((component) => (
              <ComponentRow
                key={component.id}
                component={component}
                uptime={uptimeMap.get(component.id)}
                slug={slug}
              />
            ))}
        </div>
      ))}
    </div>
  );
}
