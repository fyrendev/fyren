import { Hono } from "hono";
import { db, eq, and } from "@fyrendev/db";
import { subscribers, organizations } from "@fyrendev/db";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getEmailProvider } from "../../lib/email";
import { verificationTemplate } from "../../lib/email/templates/verification";
import { errorResponse, ValidationError, NotFoundError } from "../../lib/errors";
import { env } from "../../env";

export const subscribeRoutes = new Hono();

const subscribeSchema = z.object({
  email: z.string().email(),
  componentIds: z.array(z.string().uuid()).optional(),
});

// Subscribe to status updates
subscribeRoutes.post("/:slug/subscribe", async (c) => {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json();
    const { email, componentIds } = subscribeSchema.parse(body);

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

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
    const verificationUrl = `${env.APP_URL}/api/v1/status/${slug}/subscribe/verify/${verificationToken}`;
    const emailContent = verificationTemplate({
      organizationName: org.name,
      verificationUrl,
    });

    const provider = getEmailProvider();
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
subscribeRoutes.get("/:slug/subscribe/verify/:token", async (c) => {
  try {
    const slug = c.req.param("slug");
    const token = c.req.param("token");

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

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
subscribeRoutes.get("/:slug/unsubscribe/:token", async (c) => {
  try {
    const slug = c.req.param("slug");
    const token = c.req.param("token");

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });

    if (!org) {
      throw new NotFoundError("Organization not found");
    }

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
