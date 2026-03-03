import type { Subscriber, SubscriberGroup } from "@fyrendev/db";
import { db, eq, subscribers } from "@fyrendev/db";
import { randomBytes } from "crypto";

export interface SubscriberWithGroup extends Subscriber {
  group: SubscriberGroup | null;
}

export interface CreateManualSubscriberData {
  email: string;
  groupId?: string | null;
  componentIds?: string[] | null;
  notifyOnIncident?: boolean;
  notifyOnMaintenance?: boolean;
}

export interface UpdateSubscriberData {
  email?: string;
  groupId?: string | null;
  componentIds?: string[] | null;
  notifyOnIncident?: boolean;
  notifyOnMaintenance?: boolean;
}

export interface EligibleSubscriberFilter {
  eventType: "incident" | "maintenance" | "component";
  componentIds?: string[];
  isGlobalEvent?: boolean; // Global events (like global incidents) always notify group members
}

export const SubscriberService = {
  /**
   * Resolve the effective componentIds for a subscriber.
   * If subscriber is in a group, uses group's componentIds.
   * Otherwise, uses subscriber's own componentIds.
   */
  resolveComponentFilter(subscriber: SubscriberWithGroup): string[] | null {
    if (subscriber.group) {
      return subscriber.group.componentIds;
    }
    return subscriber.componentIds;
  },

  /**
   * Check if a subscriber should receive notifications for given components.
   */
  shouldNotifyForComponents(
    subscriber: SubscriberWithGroup,
    eventComponentIds: string[] | undefined,
    isGlobalEvent: boolean = false
  ): boolean {
    // Global events always notify (e.g., global incidents without specific components)
    if (isGlobalEvent) {
      return true;
    }

    const effectiveFilter = this.resolveComponentFilter(subscriber);

    // No filter = subscribed to all
    if (!effectiveFilter || effectiveFilter.length === 0) {
      return true;
    }

    // No components on event = notify all
    if (!eventComponentIds || eventComponentIds.length === 0) {
      return true;
    }

    // Check if any subscribed component is affected
    return eventComponentIds.some((id) => effectiveFilter.includes(id));
  },

  /**
   * Get all eligible subscribers for a notification.
   */
  async getEligibleSubscribers(filter: EligibleSubscriberFilter): Promise<SubscriberWithGroup[]> {
    const { eventType, componentIds, isGlobalEvent = false } = filter;

    // Get all verified subscribers with their groups
    const allSubs = await db.query.subscribers.findMany({
      where: eq(subscribers.verified, true),
      with: {
        group: true,
      },
    });

    // Filter by notification preferences
    const prefilteredSubs = allSubs.filter((sub) => {
      if (eventType === "incident" && !sub.notifyOnIncident) return false;
      if (eventType === "maintenance" && !sub.notifyOnMaintenance) return false;
      return true;
    });

    // Filter by component subscription
    const eligibleSubs = prefilteredSubs.filter((sub) =>
      this.shouldNotifyForComponents(sub as SubscriberWithGroup, componentIds, isGlobalEvent)
    );

    return eligibleSubs as SubscriberWithGroup[];
  },

  /**
   * Create a manually-added subscriber (admin-created, auto-verified).
   */
  async createManualSubscriber(data: CreateManualSubscriberData): Promise<Subscriber> {
    const unsubscribeToken = randomBytes(32).toString("hex");

    const [subscriber] = await db
      .insert(subscribers)
      .values({
        email: data.email,
        groupId: data.groupId || null,
        componentIds: data.componentIds || null,
        notifyOnIncident: data.notifyOnIncident ?? true,
        notifyOnMaintenance: data.notifyOnMaintenance ?? true,
        verified: true,
        verifiedAt: new Date(),
        unsubscribeToken,
      })
      .returning();

    if (!subscriber) {
      throw new Error("Failed to create subscriber");
    }

    return subscriber;
  },

  /**
   * Update an existing subscriber.
   */
  async updateSubscriber(id: string, data: UpdateSubscriberData): Promise<Subscriber> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) {
      updateData.email = data.email;
    }
    if (data.groupId !== undefined) {
      updateData.groupId = data.groupId;
    }
    if (data.componentIds !== undefined) {
      updateData.componentIds = data.componentIds;
    }
    if (data.notifyOnIncident !== undefined) {
      updateData.notifyOnIncident = data.notifyOnIncident;
    }
    if (data.notifyOnMaintenance !== undefined) {
      updateData.notifyOnMaintenance = data.notifyOnMaintenance;
    }

    const [subscriber] = await db
      .update(subscribers)
      .set(updateData)
      .where(eq(subscribers.id, id))
      .returning();

    if (!subscriber) {
      throw new Error("Subscriber not found");
    }

    return subscriber;
  },

  /**
   * Get a single subscriber with group.
   */
  async getSubscriberWithGroup(id: string): Promise<SubscriberWithGroup | null> {
    const subscriber = await db.query.subscribers.findFirst({
      where: eq(subscribers.id, id),
      with: {
        group: true,
      },
    });

    return (subscriber as SubscriberWithGroup) ?? null;
  },

  /**
   * Get all subscribers with their groups.
   */
  async getSubscribersWithGroups(): Promise<SubscriberWithGroup[]> {
    const subs = await db.query.subscribers.findMany({
      with: {
        group: true,
      },
      orderBy: (subscribers, { desc }) => [desc(subscribers.createdAt)],
    });

    return subs as SubscriberWithGroup[];
  },
};
