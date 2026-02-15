import cron from 'node-cron';
import { runAllScrapers } from '../scrapers/registry.js';
import { runDedup } from './dedup.js';
import { runFreshnessCheck } from './freshness.js';
import { runFundingTracker } from './funding-tracker.js';

let isRunning = false;

async function safeRun(name: string, fn: () => Promise<any>): Promise<void> {
  if (isRunning) {
    console.log(`[Scheduler] Skipping ${name} — another task is already running`);
    return;
  }
  isRunning = true;
  try {
    console.log(`[Scheduler] Starting: ${name}`);
    const start = Date.now();
    await fn();
    console.log(`[Scheduler] Finished: ${name} (${Date.now() - start}ms)`);
  } catch (err: any) {
    console.error(`[Scheduler] Error in ${name}:`, err.message);
  } finally {
    isRunning = false;
  }
}

export function startScheduler(): void {
  console.log('[Scheduler] Starting cron scheduler...');

  // Full scrape every 6 hours (at minute 0)
  cron.schedule('0 */6 * * *', () => {
    safeRun('full-scrape', async () => {
      await runAllScrapers();
      await runDedup();
    });
  });

  // Freshness check every 12 hours (at minute 30)
  cron.schedule('30 */12 * * *', () => {
    safeRun('freshness-check', runFreshnessCheck);
  });

  // Funding tracker every 4 hours (at minute 15)
  cron.schedule('15 */4 * * *', () => {
    safeRun('funding-tracker', runFundingTracker);
  });

  // Daily cleanup at 3:00 AM — extra dedup pass + stale cleanup
  cron.schedule('0 3 * * *', () => {
    safeRun('daily-cleanup', async () => {
      await runFreshnessCheck();
      await runDedup();
    });
  });

  console.log('[Scheduler] Cron jobs registered:');
  console.log('  - Full scrape: every 6 hours');
  console.log('  - Freshness check: every 12 hours');
  console.log('  - Funding tracker: every 4 hours');
  console.log('  - Daily cleanup: 3:00 AM');
}

// Manual trigger functions for admin API
export async function triggerFullScrape(): Promise<any> {
  return safeRun('manual-full-scrape', async () => {
    const result = await runAllScrapers();
    await runDedup();
    return result;
  });
}

export async function triggerScraper(name: string): Promise<any> {
  return safeRun(`manual-scrape-${name}`, async () => {
    const result = await runAllScrapers({ names: [name] });
    await runDedup();
    return result;
  });
}

export async function triggerFreshnessCheck(): Promise<any> {
  return safeRun('manual-freshness', runFreshnessCheck);
}

export async function triggerFundingTracker(): Promise<any> {
  return safeRun('manual-funding-tracker', runFundingTracker);
}

export async function triggerDedup(): Promise<any> {
  return safeRun('manual-dedup', runDedup);
}
