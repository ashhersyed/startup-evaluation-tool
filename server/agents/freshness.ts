import axios from 'axios';
import { getDb } from '../db/schema.js';

const MAX_CHECKS_PER_RUN = 500;
const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES_MS = 2000;
const STALE_DAYS = 14; // Mark inactive if not seen for 14 days
const MAX_AGE_DAYS = 60; // Mark inactive if older than 60 days with no re-confirmation

export async function runFreshnessCheck(): Promise<{
  checked: number;
  still_active: number;
  deactivated: number;
  errors: number;
}> {
  const db = getDb();
  console.log('[Freshness] Starting freshness check...');

  let checked = 0;
  let stillActive = 0;
  let deactivated = 0;
  let errors = 0;

  // Get active jobs ordered by oldest last_seen_at first
  const jobs = db.prepare(`
    SELECT id, url, last_seen_at, posted_at
    FROM jobs
    WHERE is_active = 1
    ORDER BY last_seen_at ASC
    LIMIT ?
  `).all(MAX_CHECKS_PER_RUN) as {
    id: number; url: string; last_seen_at: string; posted_at: string | null;
  }[];

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

          if (response.status === 200 || response.status === 301 || response.status === 302) {
            // Still active
            db.prepare('UPDATE jobs SET last_seen_at = datetime(\'now\') WHERE id = ?').run(job.id);
            return 'active';
          } else if (response.status === 404 || response.status === 410) {
            // Job removed
            db.prepare('UPDATE jobs SET is_active = 0 WHERE id = ?').run(job.id);
            return 'removed';
          }
          // Other status codes - keep as is
          return 'unknown';
        } catch {
          // Network error - don't deactivate, might be temporary
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
  const staleResult = db.prepare(`
    UPDATE jobs SET is_active = 0
    WHERE is_active = 1
    AND last_seen_at < datetime('now', '-${STALE_DAYS} days')
  `).run();
  const staleDeactivated = staleResult.changes;

  // Deactivate very old jobs
  const oldResult = db.prepare(`
    UPDATE jobs SET is_active = 0
    WHERE is_active = 1
    AND posted_at IS NOT NULL
    AND posted_at < datetime('now', '-${MAX_AGE_DAYS} days')
    AND last_seen_at < datetime('now', '-7 days')
  `).run();
  const oldDeactivated = oldResult.changes;

  deactivated += staleDeactivated + oldDeactivated;

  console.log(`[Freshness] Done: ${checked} checked, ${stillActive} active, ${deactivated} deactivated (${staleDeactivated} stale, ${oldDeactivated} old), ${errors} errors`);

  return { checked, still_active: stillActive, deactivated, errors };
}
