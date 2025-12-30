import { baseTemplate } from "./base";
import { format } from "date-fns";

export interface MaintenanceEmailData {
  organizationName: string;
  statusPageUrl: string;
  maintenanceTitle: string;
  maintenanceDescription?: string;
  maintenanceStatus: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  affectedComponents: string[];
  unsubscribeUrl: string;
}

export function maintenanceScheduledTemplate(data: MaintenanceEmailData) {
  const startFormatted = format(data.scheduledStartAt, "PPpp");
  const endFormatted = format(data.scheduledEndAt, "PPpp");

  const content = `
    <div class="header">
      <h2 style="margin: 0;">${data.organizationName} - Scheduled Maintenance</h2>
    </div>

    <h3 style="margin-bottom: 8px;">${data.maintenanceTitle}</h3>

    <p>
      <span class="status-badge status-scheduled">Scheduled</span>
    </p>

    ${data.maintenanceDescription ? `<p>${data.maintenanceDescription}</p>` : ""}

    <div class="components">
      <p><strong>Start:</strong> ${startFormatted}</p>
      <p><strong>End:</strong> ${endFormatted}</p>
      ${
        data.affectedComponents.length > 0
          ? `
      <p><strong>Affected components:</strong> ${data.affectedComponents.join(", ")}</p>
      `
          : ""
      }
    </div>

    <p>
      <a href="${data.statusPageUrl}" class="button">View Status Page</a>
    </p>
  `;

  return {
    subject: `[MAINTENANCE] ${data.maintenanceTitle} - ${format(data.scheduledStartAt, "PP")}`,
    html: baseTemplate(content, data.unsubscribeUrl),
    text: `${data.organizationName} - Scheduled Maintenance\n\n${data.maintenanceTitle}\n\nStart: ${startFormatted}\nEnd: ${endFormatted}\n\n${data.maintenanceDescription || ""}\n\nAffected: ${data.affectedComponents.join(", ")}`,
  };
}

export function maintenanceStartedTemplate(data: MaintenanceEmailData) {
  const endFormatted = format(data.scheduledEndAt, "PPpp");

  const content = `
    <div class="header">
      <h2 style="margin: 0;">${data.organizationName} - Maintenance Started</h2>
    </div>

    <h3 style="margin-bottom: 8px;">${data.maintenanceTitle}</h3>

    <p>
      <span class="status-badge status-in-progress">In Progress</span>
    </p>

    <p>Scheduled maintenance has started and is expected to complete by ${endFormatted}.</p>

    ${
      data.affectedComponents.length > 0
        ? `
    <div class="components">
      <strong>Affected components:</strong> ${data.affectedComponents.join(", ")}
    </div>
    `
        : ""
    }

    <p>
      <a href="${data.statusPageUrl}" class="button">View Status Page</a>
    </p>
  `;

  return {
    subject: `[MAINTENANCE STARTED] ${data.maintenanceTitle}`,
    html: baseTemplate(content, data.unsubscribeUrl),
    text: `${data.organizationName} - Maintenance Started\n\n${data.maintenanceTitle}\n\nExpected completion: ${endFormatted}\n\nAffected: ${data.affectedComponents.join(", ")}`,
  };
}

export function maintenanceCompletedTemplate(data: MaintenanceEmailData) {
  const content = `
    <div class="header">
      <h2 style="margin: 0;">${data.organizationName} - Maintenance Completed</h2>
    </div>

    <h3 style="margin-bottom: 8px;">${data.maintenanceTitle}</h3>

    <p>
      <span class="status-badge status-resolved">Completed</span>
    </p>

    <p>Scheduled maintenance has been completed. All systems are operational.</p>

    <p>
      <a href="${data.statusPageUrl}" class="button">View Status Page</a>
    </p>
  `;

  return {
    subject: `[MAINTENANCE COMPLETED] ${data.maintenanceTitle}`,
    html: baseTemplate(content, data.unsubscribeUrl),
    text: `${data.organizationName} - Maintenance Completed\n\n${data.maintenanceTitle}\n\nAll systems are operational.`,
  };
}
