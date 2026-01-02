import type { WebhookPayload, FormattedWebhook } from "../types";

interface TeamsFact {
  name: string;
  value: string;
}

interface TeamsSection {
  activityTitle: string;
  activitySubtitle: string;
  text: string;
  facts?: TeamsFact[];
}

export function formatTeamsWebhook(payload: WebhookPayload): FormattedWebhook {
  const { event, organization, data } = payload;

  let themeColor = "36a64f";
  let title = "";
  let text = "";

  switch (event) {
    case "incident.created":
      themeColor =
        data.severity === "critical" ? "dc2626" : data.severity === "major" ? "ea580c" : "ca8a04";
      title = `New Incident: ${data.title}`;
      text = data.message as string;
      break;
    case "incident.updated":
      themeColor = "2563eb";
      title = `Incident Update: ${data.title}`;
      text = data.message as string;
      break;
    case "incident.resolved":
      themeColor = "16a34a";
      title = `Resolved: ${data.title}`;
      text = data.message as string;
      break;
    case "maintenance.scheduled":
      themeColor = "4f46e5";
      title = `Maintenance Scheduled: ${data.title}`;
      text = `Scheduled for ${data.scheduledStartAt}`;
      break;
    case "maintenance.started":
      themeColor = "d97706";
      title = `Maintenance Started: ${data.title}`;
      text = `Expected completion: ${data.scheduledEndAt}`;
      break;
    case "maintenance.completed":
      themeColor = "16a34a";
      title = `Maintenance Completed: ${data.title}`;
      text = "All systems operational";
      break;
    default:
      title = event;
      text = JSON.stringify(data);
  }

  const section: TeamsSection = {
    activityTitle: title,
    activitySubtitle: organization.name,
    text,
  };

  const affectedComponents = data.affectedComponents as string[] | undefined;
  if (affectedComponents && affectedComponents.length > 0) {
    section.facts = [
      {
        name: "Affected Components",
        value: affectedComponents.join(", "),
      },
    ];
  }

  return {
    body: {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor,
      summary: title,
      sections: [section],
    },
  };
}
