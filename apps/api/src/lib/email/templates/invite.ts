import { baseTemplate } from "./base";

export interface InviteEmailData {
  organizationName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}

export function inviteTemplate(data: InviteEmailData) {
  const expiresFormatted = data.expiresAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const content = `
    <div class="header">
      <h2 style="margin: 0;">You've been invited to ${data.organizationName}</h2>
    </div>

    <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> as a <strong>${data.role}</strong>.</p>

    <p>Click the button below to accept the invitation:</p>

    <p>
      <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
    </p>

    <p style="color: #666; font-size: 14px;">This invitation expires on ${expiresFormatted}. If you didn't expect this, you can safely ignore this email.</p>
  `;

  return {
    subject: `You've been invited to join ${data.organizationName}`,
    html: baseTemplate(
      content,
      undefined,
      "You're receiving this because someone invited you to their team."
    ),
    text: `You've been invited to ${data.organizationName}\n\n${data.inviterName} has invited you to join ${data.organizationName} as a ${data.role}.\n\nAccept the invitation: ${data.inviteUrl}\n\nThis invitation expires on ${expiresFormatted}. If you didn't expect this, you can safely ignore this email.`,
  };
}
