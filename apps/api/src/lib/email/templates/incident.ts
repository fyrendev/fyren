import { baseTemplate } from "./base";

export interface IncidentEmailData {
  organizationName: string;
  statusPageUrl: string;
  incidentTitle: string;
  incidentStatus: string;
  incidentSeverity: string;
  message: string;
  affectedComponents: string[];
  incidentUrl: string;
  unsubscribeUrl: string;
}

export function incidentCreatedTemplate(data: IncidentEmailData) {
  const content = `
    <div class="header">
      <h2 style="margin: 0;">${data.organizationName} Status Update</h2>
    </div>

    <h3 style="margin-bottom: 8px;">${data.incidentTitle}</h3>

    <p>
      <span class="status-badge status-${data.incidentStatus}">${data.incidentStatus}</span>
      <span class="status-badge severity-${data.incidentSeverity}">${data.incidentSeverity}</span>
    </p>

    <p>${data.message}</p>

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
      <a href="${data.incidentUrl}" class="button" style="display: inline-block; padding: 12px 24px; background: #0066ff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">View Incident</a>
    </p>
  `;

  return {
    subject: `[${data.incidentSeverity.toUpperCase()}] ${data.incidentTitle}`,
    html: baseTemplate(content, data.unsubscribeUrl),
    text: `${data.organizationName} Status Update\n\n${data.incidentTitle}\n\nStatus: ${data.incidentStatus}\nSeverity: ${data.incidentSeverity}\n\n${data.message}\n\nView incident: ${data.incidentUrl}`,
  };
}

export function incidentUpdatedTemplate(data: IncidentEmailData) {
  const content = `
    <div class="header">
      <h2 style="margin: 0;">${data.organizationName} Status Update</h2>
    </div>

    <h3 style="margin-bottom: 8px;">${data.incidentTitle}</h3>

    <p>
      <span class="status-badge status-${data.incidentStatus}">${data.incidentStatus}</span>
    </p>

    <p>${data.message}</p>

    <p>
      <a href="${data.incidentUrl}" class="button" style="display: inline-block; padding: 12px 24px; background: #0066ff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">View Incident</a>
    </p>
  `;

  return {
    subject: `[UPDATE] ${data.incidentTitle}`,
    html: baseTemplate(content, data.unsubscribeUrl),
    text: `${data.organizationName} Status Update\n\n${data.incidentTitle}\n\nStatus: ${data.incidentStatus}\n\n${data.message}\n\nView incident: ${data.incidentUrl}`,
  };
}

export function incidentResolvedTemplate(data: IncidentEmailData) {
  const content = `
    <div class="header">
      <h2 style="margin: 0;">${data.organizationName} Status Update</h2>
    </div>

    <h3 style="margin-bottom: 8px;">Resolved: ${data.incidentTitle}</h3>

    <p>
      <span class="status-badge status-resolved">Resolved</span>
    </p>

    <p>${data.message}</p>

    <p>
      <a href="${data.incidentUrl}" class="button" style="display: inline-block; padding: 12px 24px; background: #0066ff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">View Incident</a>
    </p>
  `;

  return {
    subject: `[RESOLVED] ${data.incidentTitle}`,
    html: baseTemplate(content, data.unsubscribeUrl),
    text: `${data.organizationName} Status Update\n\nResolved: ${data.incidentTitle}\n\n${data.message}\n\nView incident: ${data.incidentUrl}`,
  };
}
