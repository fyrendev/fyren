import { db } from "../lib/db";
import { maintenances, eq, and, gte, lte } from "@fyrendev/db";
import { MaintenanceScheduler } from "./maintenance-scheduler.service";

export async function rescheduleMaintenanceJobs() {
  console.log("[Startup] Rescheduling maintenance jobs...");

  const now = new Date();

  // Find all scheduled maintenance with future start times that have autoStart enabled
  const scheduledMaintenance = await db
    .select({
      id: maintenances.id,
      scheduledStartAt: maintenances.scheduledStartAt,
    })
    .from(maintenances)
    .where(
      and(
        eq(maintenances.status, "scheduled"),
        eq(maintenances.autoStart, true),
        gte(maintenances.scheduledStartAt, now)
      )
    );

  for (const m of scheduledMaintenance) {
    await MaintenanceScheduler.scheduleStart(m.id, m.scheduledStartAt);
    console.log(`[Startup] Scheduled start for maintenance: ${m.id}`);
  }

  // Find all in-progress maintenance with future end times that have autoComplete enabled
  const inProgressMaintenance = await db
    .select({
      id: maintenances.id,
      scheduledEndAt: maintenances.scheduledEndAt,
    })
    .from(maintenances)
    .where(
      and(
        eq(maintenances.status, "in_progress"),
        eq(maintenances.autoComplete, true),
        gte(maintenances.scheduledEndAt, now)
      )
    );

  for (const m of inProgressMaintenance) {
    await MaintenanceScheduler.scheduleComplete(m.id, m.scheduledEndAt);
    console.log(`[Startup] Scheduled complete for maintenance: ${m.id}`);
  }

  // Also schedule any scheduled maintenance that should have auto-started (overdue)
  const overdueScheduled = await db
    .select({
      id: maintenances.id,
    })
    .from(maintenances)
    .where(
      and(
        eq(maintenances.status, "scheduled"),
        eq(maintenances.autoStart, true),
        lte(maintenances.scheduledStartAt, now)
      )
    );

  for (const m of overdueScheduled) {
    await MaintenanceScheduler.scheduleStart(m.id, new Date()); // Start immediately
    console.log(`[Startup] Scheduling overdue start for maintenance: ${m.id}`);
  }

  console.log(
    `[Startup] Rescheduled ${scheduledMaintenance.length + inProgressMaintenance.length + overdueScheduled.length} maintenance jobs`
  );
}
