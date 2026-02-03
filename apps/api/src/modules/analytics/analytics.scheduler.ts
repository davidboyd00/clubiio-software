import { analyticsService } from './analytics.service';

let schedulerStarted = false;
let intervalHandle: NodeJS.Timeout | null = null;
let timeoutHandle: NodeJS.Timeout | null = null;

const RUN_HOUR = parseInt(process.env.ANALYTICS_SNAPSHOT_HOUR || '4', 10);
const RUN_MINUTE = parseInt(process.env.ANALYTICS_SNAPSHOT_MINUTE || '0', 10);

const msUntilNextRun = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(RUN_HOUR, RUN_MINUTE, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
};

async function runSnapshotJob(label: string) {
  try {
    await analyticsService.createDailySnapshots(new Date());
    console.log(`[Analytics] Daily snapshots completed (${label}).`);
  } catch (error) {
    console.error('[Analytics] Snapshot job failed:', error);
  }
}

export function startAnalyticsSnapshotScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  runSnapshotJob('bootstrap');

  const delay = msUntilNextRun();
  timeoutHandle = setTimeout(() => {
    runSnapshotJob('scheduled');
    intervalHandle = setInterval(() => {
      runSnapshotJob('scheduled');
    }, 24 * 60 * 60 * 1000);
  }, delay);

  console.log(`[Analytics] Snapshot scheduler enabled (daily ${RUN_HOUR.toString().padStart(2, '0')}:${RUN_MINUTE.toString().padStart(2, '0')}).`);
}

export function stopAnalyticsSnapshotScheduler() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
  }
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  schedulerStarted = false;
}
