import { getDb } from '../db/schema.js';
import { generateDedupHash, normalizeTitle } from '../scrapers/base.js';

export async function runDedup(): Promise<{ merged: number; deactivated: number }> {
  const db = getDb();
  console.log('[Dedup] Starting deduplication pass...');

  let merged = 0;
  let deactivated = 0;

  // Find all active jobs grouped by dedup_hash where there are duplicates
  const duplicateGroups = db.prepare(`
    SELECT dedup_hash, COUNT(*) as cnt
    FROM jobs
    WHERE is_active = 1
    GROUP BY dedup_hash
    HAVING cnt > 1
  `).all() as { dedup_hash: string; cnt: number }[];

  console.log(`[Dedup] Found ${duplicateGroups.length} groups with duplicates`);

  for (const group of duplicateGroups) {
    const jobs = db.prepare(`
      SELECT id, title, description, url, source, salary_min, salary_max, posted_at, merged_from
      FROM jobs
      WHERE dedup_hash = ? AND is_active = 1
      ORDER BY
        CASE WHEN description IS NOT NULL AND LENGTH(description) > 0 THEN 0 ELSE 1 END,
        CASE WHEN salary_min IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN posted_at IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC
    `).all() as {
      id: number; title: string; description: string | null; url: string;
      source: string; salary_min: number | null; salary_max: number | null;
      posted_at: string | null; merged_from: string;
    }[];

    if (jobs.length < 2) continue;

    // Keep the first (richest) record as primary
    const primary = jobs[0];
    const others = jobs.slice(1);

    // Merge all source URLs into primary
    const allMergedFrom = JSON.parse(primary.merged_from || '[]') as string[];
    for (const other of others) {
      if (!allMergedFrom.includes(other.url)) {
        allMergedFrom.push(other.url);
      }
      // Also add any previously merged URLs from the duplicate
      const otherMerged = JSON.parse(other.merged_from || '[]') as string[];
      for (const url of otherMerged) {
        if (!allMergedFrom.includes(url)) {
          allMergedFrom.push(url);
        }
      }
    }

    // Update primary with merged data
    // Take the best description (longest), earliest posted_at, and salary if primary lacks them
    let bestDescription = primary.description;
    let bestSalaryMin = primary.salary_min;
    let bestSalaryMax = primary.salary_max;
    let earliestPosted = primary.posted_at;

    for (const other of others) {
      if (other.description && (!bestDescription || other.description.length > bestDescription.length)) {
        bestDescription = other.description;
      }
      if (other.salary_min && !bestSalaryMin) {
        bestSalaryMin = other.salary_min;
        bestSalaryMax = other.salary_max;
      }
      if (other.posted_at && (!earliestPosted || other.posted_at < earliestPosted)) {
        earliestPosted = other.posted_at;
      }
    }

    db.prepare(`
      UPDATE jobs SET
        merged_from = ?,
        description = COALESCE(?, description),
        salary_min = COALESCE(?, salary_min),
        salary_max = COALESCE(?, salary_max),
        posted_at = COALESCE(?, posted_at),
        last_seen_at = datetime('now')
      WHERE id = ?
    `).run(
      JSON.stringify(allMergedFrom),
      bestDescription, bestSalaryMin, bestSalaryMax, earliestPosted,
      primary.id
    );

    // Deactivate duplicates
    const otherIds = others.map(o => o.id);
    db.prepare(
      `UPDATE jobs SET is_active = 0 WHERE id IN (${otherIds.map(() => '?').join(',')})`
    ).run(...otherIds);

    merged += 1;
    deactivated += others.length;
  }

  console.log(`[Dedup] Done: ${merged} groups merged, ${deactivated} duplicates deactivated`);
  return { merged, deactivated };
}
