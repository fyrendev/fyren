export function baseTemplate(content: string, unsubscribeUrl?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .card { background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { margin-bottom: 24px; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: 500; }
    .status-investigating { background: #fee2e2; color: #dc2626; }
    .status-identified { background: #ffedd5; color: #ea580c; }
    .status-monitoring { background: #dbeafe; color: #2563eb; }
    .status-resolved { background: #dcfce7; color: #16a34a; }
    .status-scheduled { background: #e0e7ff; color: #4f46e5; }
    .status-in-progress { background: #fef3c7; color: #d97706; }
    .status-in_progress { background: #fef3c7; color: #d97706; }
    .severity-minor { background: #fef9c3; color: #ca8a04; }
    .severity-major { background: #ffedd5; color: #ea580c; }
    .severity-critical { background: #fee2e2; color: #dc2626; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background: #0066ff; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; }
    .components { margin: 16px 0; padding: 12px; background: #f9fafb; border-radius: 6px; }
    .timeline-item { padding: 12px 0; border-bottom: 1px solid #e5e5e5; }
    .timeline-item:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>You're receiving this because you subscribed to status updates.</p>
      ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}">Unsubscribe</a></p>` : ""}
      <p>Powered by <a href="https://fyren.dev">Fyren</a></p>
    </div>
  </div>
</body>
</html>
`;
}
