import axios from 'axios';
import { getStore, updateJob, JobRow } from '../db/store.js';

const MAX_CHECKS_PER_RUN = 500;
const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES_MS = 2000;
const STALE_DAYS = 14;
const MAX_AGE_DAYS = 60;

export async function runFreshnessCheck(): Promise<{
  checked: number;
  still_active: number;
  deactivated: number;
  errors: number;
}> {
  const store = getStore();
  console.log('[Freshness] Starting freshness check...');

  let checked = 0;
  let stillActive = 0;
  let deactivated = 0;
  let errors = 0;

  // Get active jobs ordered by oldest last_seen_at first
  const jobs = Object.values(store.jobs)
    .filter(j => j.is_active === 1)
    .sort((a, b) => a.last_seen_at.localeCompare(b.last_seen_at))
    .slice(0, MAX_CHECKS_PER_RUN);

  console.log(`[Freshness] Checking ${jobs.length} jobs...`);

  // Process in batches
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (job) => {
        try {
          const response = await axios.head(job.url, {
            timeout: 10000,
            maxRedirects: 3,
            validateStatus: (status) => status < 500,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          });

          const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');

          if (response.status === 200 || response.status === 301 || response.status === 302) {
            updateJob(job.id, { last_seen_at: ts });
            return 'active';
          } else if (response.status === 404 || response.status === 410) {
            updateJob(job.id, { is_active: 0 });
            return 'removed';
          }
          return 'unknown';
        } catch {
          return 'error';
        }
      })
    );

    for (const result of results) {
      checked++;
      if (result.status === 'fulfilled') {
        if (result.value === 'active') stillActive++;
        else if (result.value === 'removed') deactivated++;
        else if (result.value === 'error') errors++;
      } else {
        errors++;
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < jobs.length) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  // Deactivate stale jobs (not seen for STALE_DAYS)
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
  let staleDeactivated = 0;
  for (const job of Object.values(store.jobs)) {
    if (job.is_active === 1 && job.last_seen_at < staleThreshold) {
      updateJob(job.id, { is_active: 0 });
      staleDeactivated++;
    }
  }

  // Deactivate very old jobs
  const oldThreshold = new Date(Date.now() - MAX_AGE_DAYS * 86400000).toISOString();
  const weekThreshold = new Date(Date.now() - 7 * 86400000).toISOString();
  let oldDeactivated = 0;
  for (const job of Object.values(store.jobs)) {
    if (
      job.is_active === 1 &&
      job.posted_at != null &&
      job.posted_at < oldThreshold &&
      job.last_seen_at < weekThreshold
    ) {
      updateJob(job.id, { is_active: 0 });
      oldDeactivated++;
    }
  }

  deactivated += staleDeactivated + oldDeactivated;

  console.log(`[Freshness] Done: ${checked} checked, ${stillActive} active, ${deactivated} deactivated (${staleDeactivated} stale, ${oldDeactivated} old), ${errors} errors`);

  return { checked, still_active: stillActive, deactivated, errors };
}
