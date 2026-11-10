import { getStagedRetentionDays } from "./settings";
import { purgeExpiredStagedImages } from "./stagedImages";

const RUN_INTERVAL_MS = 60 * 60 * 1000;

let running = false;

// Runs in-process rather than as a separate cron service: the API is a
// single always-on instance (Render starter plan doesn't sleep), so an
// hourly timer is enough. Images are deleted within an hour of passing the
// retention window.
export async function runStagedRetention(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const days = await getStagedRetentionDays();
    const purged = await purgeExpiredStagedImages(days);
    if (purged > 0) {
      console.log(`Retention: deleted ${purged} staged image(s) older than ${days} day(s).`);
    }
  } catch (error) {
    console.error("Retention: failed to purge expired staged images:", error);
  } finally {
    running = false;
  }
}

export function startRetentionJob(): void {
  void runStagedRetention();
  setInterval(() => void runStagedRetention(), RUN_INTERVAL_MS).unref();
}
