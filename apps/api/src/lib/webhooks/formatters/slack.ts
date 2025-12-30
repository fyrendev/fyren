import type { WebhookPayload, FormattedWebhook } from "../types";

interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

interface SlackAttachment {
  color: string;
  title: string;
  text: string;
  footer: string;
  ts: number;
  fields?: SlackField[];
}

export function formatSlackWebhook(payload: WebhookPayload): FormattedWebhook {
  const { event, organization, data } = payload;

  let color = "#36a64f"; // green
  let title = "";
  let text = "";

  switch (event) {
    case "incident.created":
      color =
        data.severity === "critical"
          ? "#dc2626"
          : data.severity === "major"
            ? "#ea580c"
            : "#ca8a04";
      title = `New Incident: ${data.title}`;
      text = data.message as string;
      break;
    case "incident.updated":
      color = "#2563eb";
      title = `Incident Update: ${data.title}`;
      text = data.message as string;
      break;
    case "incident.resolved":
      color = "#16a34a";
      title = `Resolved: ${data.title}`;
      text = data.message as string;
      break;
    case "maintenance.scheduled":
      color = "#4f46e5";
      title = `Maintenance Scheduled: ${data.title}`;
      text = `Scheduled for ${data.scheduledStartAt}`;
      break;
    case "maintenance.started":
      color = "#d97706";
      title = `Maintenance Started: ${data.title}`;
      text = `Expected completion: ${data.scheduledEndAt}`;
      break;
    case "maintenance.completed":
      color = "#16a34a";
      title = `Maintenance Completed: ${data.title}`;
      text = "All systems operational";
      break;
    default:
      title = event;
      text = JSON.stringify(data);
  }

  const attachment: SlackAttachment = {
    color,
    title,
    text,
    footer: organization.name,
    ts: Math.floor(Date.now() / 1000),
  };

  const affectedComponents = data.affectedComponents as string[] | undefined;
  if (affectedComponents && affectedComponents.length > 0) {
    attachment.fields = [
      {
        title: "Affected Components",
        value: affectedComponents.join(", "),
        short: false,
      },
    ];
  }

  return {
    body: {
      attachments: [attachment],
    },
  };
}
