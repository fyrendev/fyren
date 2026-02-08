import { Hono } from "hono";
import { db, eq, and, asc } from "@fyrendev/db";
import { subscribers, organizations } from "@fyrendev/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getEmailProviderForOrg } from "../../lib/email";
import { verificationTemplate } from "../../lib/email/templates/verification";
import { errorResponse, NotFoundError } from "../../lib/errors";
import { env } from "../../env";

export const subscribeRoutes = new Hono();

function renderActionPage({
  title,
  message,
  linkUrl,
  linkText,
}: {
  title: string;
  message: string;
  linkUrl?: string;
  linkText?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Fyren</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#1e293b}
    .card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:2.5rem;max-width:440px;width:100%;text-align:center}
    h1{font-size:1.25rem;margin-bottom:.75rem}
    p{color:#64748b;line-height:1.6;margin-bottom:1.25rem}
    a.btn{display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:.6rem 1.5rem;border-radius:8px;font-size:.9rem;transition:background .15s}
    a.btn:hover{background:#334155}
    .brand{margin-top:1.5rem;font-size:.75rem;color:#94a3b8}
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${linkUrl ? `<a class="btn" href="${linkUrl}">${linkText || "Continue"}</a>` : ""}
    <div class="brand">Powered by Fyren</div>
  </div>
</body>
</html>`;
}

// Helper to get the organization
async function getOrganization() {
  const [org] = await db
    .select()
    .from(organizations)
    .orderBy(asc(organizations.createdAt))
    .limit(1);
  if (!org) throw new NotFoundError("No organization configured");
  return org;
}

const subscribeSchema = z.object({
  email: z.string().email(),
  componentIds: z.array(z.string().uuid()).optional(),
});

// Subscribe to status updates
subscribeRoutes.post("/subscribe", async (c) => {
  try {
    const body = await c.req.json();
    const { email, componentIds } = subscribeSchema.parse(body);

    const org = await getOrganization();

    // Check if already subscribed
    const existing = await db.query.subscribers.findFirst({
      where: and(eq(subscribers.organizationId, org.id), eq(subscribers.email, email)),
    });

    if (existing?.verified) {
      return c.json({ message: "Already subscribed" });
    }

    const verificationToken = randomBytes(32).toString("hex");
    const unsubscribeToken = randomBytes(32).toString("hex");

    if (existing) {
      // Update existing unverified subscription
      await db
        .update(subscribers)
        .set({
          verificationToken,
          componentIds: componentIds || null,
          updatedAt: new Date(),
        })
        .where(eq(subscribers.id, existing.id));
    } else {
      // Create new subscription
      await db.insert(subscribers).values({
        organizationId: org.id,
        email,
        verificationToken,
        unsubscribeToken,
        componentIds: componentIds || null,
      });
    }

    // Send verification email
    const verificationUrl = `${env.APP_URL}/api/v1/status/subscribe/verify/${verificationToken}`;
    const emailContent = verificationTemplate({
      organizationName: org.name,
      verificationUrl,
    });

    const provider = await getEmailProviderForOrg(org.id);
    await provider.send({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return c.json({ message: "Verification email sent" });
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Verify subscription
subscribeRoutes.get("/subscribe/verify/:token", async (c) => {
  try {
    const token = c.req.param("token");

    const org = await getOrganization();

    const subscriber = await db.query.subscribers.findFirst({
      where: and(eq(subscribers.organizationId, org.id), eq(subscribers.verificationToken, token)),
    });

    if (!subscriber) {
      return c.html(
        renderActionPage({
          title: "Invalid Link",
          message: "This verification link is invalid or has expired.",
        }),
        400
      );
    }

    if (subscriber.verified) {
      return c.html(
        renderActionPage({
          title: "Already Verified",
          message: "Your subscription has already been verified.",
          linkUrl: `${env.APP_URL}/${org.slug}`,
          linkText: "View Status Page",
        })
      );
    }

    await db
      .update(subscribers)
      .set({
        verified: true,
        verifiedAt: new Date(),
        verificationToken: null, // Clear token after use
        updatedAt: new Date(),
      })
      .where(eq(subscribers.id, subscriber.id));

    return c.html(
      renderActionPage({
        title: "Subscription Confirmed",
        message: "You will now receive status updates via email.",
        linkUrl: `${env.APP_URL}`,
        linkText: "View Status Page",
      })
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

// Unsubscribe
subscribeRoutes.get("/unsubscribe/:token", async (c) => {
  try {
    const token = c.req.param("token");

    const org = await getOrganization();

    const subscriber = await db.query.subscribers.findFirst({
      where: and(eq(subscribers.organizationId, org.id), eq(subscribers.unsubscribeToken, token)),
    });

    if (!subscriber) {
      return c.html(
        renderActionPage({
          title: "Invalid Link",
          message: "This unsubscribe link is invalid or has already been used.",
        }),
        400
      );
    }

    await db.delete(subscribers).where(eq(subscribers.id, subscriber.id));

    return c.html(
      renderActionPage({
        title: "Unsubscribed",
        message: "You have been unsubscribed and will no longer receive status updates.",
        linkUrl: `${env.APP_URL}/${org.slug}`,
        linkText: "View Status Page",
      })
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});
