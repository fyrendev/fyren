import { baseTemplate } from "./base";

export interface VerificationEmailData {
  organizationName: string;
  verificationUrl: string;
}

export function verificationTemplate(data: VerificationEmailData) {
  const content = `
    <div class="header">
      <h2 style="margin: 0;">Confirm your subscription</h2>
    </div>

    <p>You requested to receive status updates from <strong>${data.organizationName}</strong>.</p>

    <p>Click the button below to confirm your subscription:</p>

    <p>
      <a href="${data.verificationUrl}" class="button" style="display: inline-block; padding: 12px 24px; background: #0066ff; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500;">Confirm Subscription</a>
    </p>

    <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
  `;

  return {
    subject: `Confirm your subscription to ${data.organizationName} status updates`,
    html: baseTemplate(content),
    text: `Confirm your subscription\n\nYou requested to receive status updates from ${data.organizationName}.\n\nClick here to confirm: ${data.verificationUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
  };
}
