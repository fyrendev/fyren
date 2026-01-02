import { Hono } from "hono";
import { db, eq, desc } from "@fyrendev/db";
import { organizations, incidents, incidentUpdates } from "@fyrendev/db";
import { env } from "../../env";

export const rssRoutes = new Hono();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// RSS feed for incidents
rssRoutes.get("/:slug/rss", async (c) => {
  const slug = c.req.param("slug");

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });

  if (!org) {
    return c.json({ error: { message: "Organization not found" } }, 404);
  }

  // Get recent incidents
  const recentIncidents = await db
    .select()
    .from(incidents)
    .where(eq(incidents.organizationId, org.id))
    .orderBy(desc(incidents.createdAt))
    .limit(20);

  const statusPageUrl = `${env.APP_URL}/${slug}`;

  // Build items with latest update for each incident
  const items: string[] = [];
  for (const incident of recentIncidents) {
    // Get latest update for this incident
    const [latestUpdate] = await db
      .select()
      .from(incidentUpdates)
      .where(eq(incidentUpdates.incidentId, incident.id))
      .orderBy(desc(incidentUpdates.createdAt))
      .limit(1);

    const pubDate = new Date(latestUpdate?.createdAt || incident.createdAt).toUTCString();
    const status = incident.resolvedAt ? "Resolved" : incident.status;

    items.push(`
    <item>
      <title>${escapeXml(`${incident.title} - ${status}`)}</title>
      <link>${statusPageUrl}/incidents/${incident.id}</link>
      <guid isPermaLink="true">${statusPageUrl}/incidents/${incident.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(latestUpdate?.message || incident.title)}</description>
    </item>`);
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(org.name)} Status</title>
    <link>${statusPageUrl}</link>
    <description>Status updates for ${escapeXml(org.name)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${statusPageUrl}/rss" rel="self" type="application/rss+xml"/>
    ${items.join("\n")}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300", // 5 minute cache
    },
  });
});
