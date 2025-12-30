import type { WebhookPayload, FormattedWebhook } from "../types";

interface DiscordField {
  name: string;
  value: string;
  inline: boolean;
}

interface DiscordEmbed {
  color: number;
  title: string;
  description: string;
  footer: { text: string };
  timestamp: string;
  fields?: DiscordField[];
}

export function formatDiscordWebhook(payload: WebhookPayload): FormattedWebhook {
  const { event, organization, data } = payload;

  let color = 0x36a64f; // green
  let title = "";
  let description = "";

  switch (event) {
    case "incident.created":
      color =
        data.severity === "critical"
          ? 0xdc2626
          : data.severity === "major"
            ? 0xea580c
            : 0xca8a04;
      title = `New Incident: ${data.title}`;
      description = data.message as string;
      break;
    case "incident.updated":
      color = 0x2563eb;
      title = `Incident Update: ${data.title}`;
      description = data.message as string;
      break;
    case "incident.resolved":
      color = 0x16a34a;
      title = `Resolved: ${data.title}`;
      description = data.message as string;
      break;
    case "maintenance.scheduled":
      color = 0x4f46e5;
      title = `Maintenance Scheduled: ${data.title}`;
      description = `Scheduled for ${data.scheduledStartAt}`;
      break;
    case "maintenance.started":
      color = 0xd97706;
      title = `Maintenance Started: ${data.title}`;
      description = `Expected completion: ${data.scheduledEndAt}`;
      break;
    case "maintenance.completed":
      color = 0x16a34a;
      title = `Maintenance Completed: ${data.title}`;
      description = "All systems operational";
      break;
    default:
      title = event;
      description = JSON.stringify(data);
  }

  const embed: DiscordEmbed = {
    color,
    title,
    description,
    footer: { text: organization.name },
    timestamp: new Date().toISOString(),
  };

  const affectedComponents = data.affectedComponents as string[] | undefined;
  if (affectedComponents && affectedComponents.length > 0) {
    embed.fields = [
      {
        name: "Affected Components",
        value: affectedComponents.join(", "),
        inline: false,
      },
    ];
  }

  return {
    body: {
      embeds: [embed],
    },
  };
}
