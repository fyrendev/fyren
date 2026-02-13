import { Hono } from "hono";
import { getOrganization } from "../../lib/organization";
import { env } from "../../env";
import { widgetCorsHeaders, cacheHeaders } from "../../middleware/security";
import { badgeRateLimit } from "../../middleware/rateLimit";

export const widgetRoutes = new Hono();

// Apply rate limiting, CORS, and caching
widgetRoutes.use("*", badgeRateLimit);
widgetRoutes.use("*", widgetCorsHeaders());
widgetRoutes.use("*", cacheHeaders(3600)); // Cache for 1 hour

// GET /api/v1/status/widget.js - Widget JavaScript loader
widgetRoutes.get("/widget.js", async (_c) => {
  const appUrl = env.APP_URL || "http://localhost:3000";

  // Verify org exists
  let org;
  try {
    org = await getOrganization();
  } catch {
    return new Response("// Organization not found", {
      status: 404,
      headers: { "Content-Type": "application/javascript" },
    });
  }

  const js = `
/**
 * Fyren Status Widget Loader
 * Organization: ${org.name}
 *
 * Usage:
 * 1. Add this script to your page:
 *    <script src="${appUrl}/api/v1/status/widget.js" async></script>
 *
 * 2. Add a container where you want the widget:
 *    <div data-fyren-widget></div>
 *
 * Options (data attributes):
 * - data-theme="light|dark" - Color theme
 * - data-style="minimal|compact|full" - Widget style
 */
(function() {
  'use strict';

  var FYREN_URL = '${appUrl}';

  // Widget configuration
  var config = {
    widgetUrl: FYREN_URL + '/widget',
    statusUrl: FYREN_URL,
    defaultHeight: 80,
    defaultStyle: 'compact'
  };

  // Create widget iframe
  function createWidget(container) {
    var theme = container.getAttribute('data-theme') || 'light';
    var style = container.getAttribute('data-style') || config.defaultStyle;

    var iframe = document.createElement('iframe');
    iframe.src = config.widgetUrl + '?theme=' + theme + '&style=' + style;
    iframe.style.cssText = 'width:100%;height:' + config.defaultHeight + 'px;border:none;overflow:hidden;';
    iframe.setAttribute('title', 'Status Widget');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'no-referrer');

    container.appendChild(iframe);

    // Handle resize messages from iframe
    window.addEventListener('message', function(event) {
      if (event.origin !== FYREN_URL) return;

      try {
        var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        if (data.type === 'fyren-resize') {
          iframe.style.height = data.height + 'px';
        }
      } catch (e) {
        // Ignore invalid messages
      }
    });

    return iframe;
  }

  // Initialize widgets on page
  function init() {
    var containers = document.querySelectorAll('[data-fyren-widget]');

    containers.forEach(function(container) {
      // Skip if already initialized
      if (container.getAttribute('data-fyren-initialized')) return;

      container.setAttribute('data-fyren-initialized', 'true');
      createWidget(container);
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Observe for dynamically added containers
  if (window.MutationObserver) {
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            if (node.hasAttribute && node.hasAttribute('data-fyren-widget')) {
              if (!node.getAttribute('data-fyren-initialized')) {
                node.setAttribute('data-fyren-initialized', 'true');
                createWidget(node);
              }
            }
            // Also check descendants
            var descendants = node.querySelectorAll && node.querySelectorAll('[data-fyren-widget]:not([data-fyren-initialized])');
            if (descendants) {
              descendants.forEach(function(desc) {
                desc.setAttribute('data-fyren-initialized', 'true');
                createWidget(desc);
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Expose API for manual widget creation
  window.FyrenWidget = {
    create: function(container) {
      if (typeof container === 'string') {
        container = document.querySelector(container);
      }
      if (container && !container.getAttribute('data-fyren-initialized')) {
        container.setAttribute('data-fyren-initialized', 'true');
        return createWidget(container);
      }
      return null;
    },
    config: config
  };
})();
`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
});

// GET /api/v1/status/embed.html - Embed code snippet page
widgetRoutes.get("/embed.html", async (c) => {
  const appUrl = env.APP_URL || "http://localhost:3000";

  // Verify org exists
  let org;
  try {
    org = await getOrganization();
  } catch {
    return c.text("Organization not found", 404);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Embed ${org.name} Status Widget</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    h1 { color: #1e293b; }
    .code-block { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
    code { font-family: monospace; }
    .preview { border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; }
    .section { margin: 2rem 0; }
  </style>
</head>
<body>
  <h1>Embed ${org.name} Status Widget</h1>

  <div class="section">
    <h2>Widget</h2>
    <p>Add the following code to your website:</p>
    <div class="code-block">
      <code>&lt;script src="${appUrl}/api/v1/status/widget.js" async&gt;&lt;/script&gt;<br>
&lt;div data-fyren-widget&gt;&lt;/div&gt;</code>
    </div>
    <h3>Preview</h3>
    <div class="preview">
      <div data-fyren-widget></div>
    </div>
  </div>

  <div class="section">
    <h2>Status Badge</h2>
    <p>Add a status badge to your README or website:</p>
    <h3>Markdown</h3>
    <div class="code-block">
      <code>[![Status](${appUrl}/api/v1/status/badge.svg)](${appUrl})</code>
    </div>
    <h3>HTML</h3>
    <div class="code-block">
      <code>&lt;a href="${appUrl}"&gt;<br>
  &lt;img src="${appUrl}/api/v1/status/badge.svg" alt="Status"&gt;<br>
&lt;/a&gt;</code>
    </div>
    <h3>Preview</h3>
    <div class="preview">
      <a href="${appUrl}">
        <img src="${appUrl}/api/v1/status/badge.svg" alt="Status">
      </a>
    </div>
  </div>

  <script src="${appUrl}/api/v1/status/widget.js" async></script>
</body>
</html>`;

  return c.html(html);
});
