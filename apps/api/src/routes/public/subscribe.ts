import { Hono } from "hono";
import { db, eq, and, asc } from "@fyrendev/db";
import { subscribers, organizations } from "@fyrendev/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getEmailProviderForOrg } from "../../lib/email";
import { verificationTemplate } from "../../lib/email/templates/verification";
import { errorResponse, ValidationError, NotFoundError } from "../../lib/errors";
import { env } from "../../env";

export const subscribeRoutes = new Hono();

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
      throw new ValidationError("Invalid verification token");
    }

    if (subscriber.verified) {
      return c.json({ message: "Already verified" });
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

    return c.json({ message: "Subscription confirmed" });
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
      throw new ValidationError("Invalid unsubscribe token");
    }

    await db.delete(subscribers).where(eq(subscribers.id, subscriber.id));

    return c.json({ message: "Successfully unsubscribed" });
  } catch (error) {
    return errorResponse(c, error);
  }
});
