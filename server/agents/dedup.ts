import { getStore, updateJob, JobRow } from '../db/store.js';

export async function runDedup(): Promise<{ merged: number; deactivated: number }> {
  const store = getStore();
  console.log('[Dedup] Starting deduplication pass...');

  let merged = 0;
  let deactivated = 0;

  // Group active jobs by dedup_hash
  const groups = new Map<string, JobRow[]>();
  for (const job of Object.values(store.jobs)) {
    if (job.is_active !== 1) continue;
    const existing = groups.get(job.dedup_hash) || [];
    existing.push(job);
    groups.set(job.dedup_hash, existing);
  }

  // Find groups with duplicates
  const duplicateGroups = [...groups.entries()].filter(([_, jobs]) => jobs.length > 1);
  console.log(`[Dedup] Found ${duplicateGroups.length} groups with duplicates`);

  for (const [_, jobs] of duplicateGroups) {
    // Sort: prefer jobs with description, salary, posted_at, then oldest first
    jobs.sort((a, b) => {
      const aDesc = a.description && a.description.length > 0 ? 0 : 1;
      const bDesc = b.description && b.description.length > 0 ? 0 : 1;
      if (aDesc !== bDesc) return aDesc - bDesc;

      const aSal = a.salary_min != null ? 0 : 1;
      const bSal = b.salary_min != null ? 0 : 1;
      if (aSal !== bSal) return aSal - bSal;

      const aPosted = a.posted_at != null ? 0 : 1;
      const bPosted = b.posted_at != null ? 0 : 1;
      if (aPosted !== bPosted) return aPosted - bPosted;

      return a.created_at.localeCompare(b.created_at);
    });

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
      const otherMerged = JSON.parse(other.merged_from || '[]') as string[];
      for (const url of otherMerged) {
        if (!allMergedFrom.includes(url)) {
          allMergedFrom.push(url);
        }
      }
    }

    // Find best data across duplicates
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

    // Update primary with merged data
    updateJob(primary.id, {
      merged_from: JSON.stringify(allMergedFrom),
      description: bestDescription || primary.description,
      salary_min: bestSalaryMin ?? primary.salary_min,
      salary_max: bestSalaryMax ?? primary.salary_max,
      posted_at: earliestPosted || primary.posted_at,
      last_seen_at: new Date().toISOString().replace('T', ' ').replace('Z', ''),
    });

    // Deactivate duplicates
    for (const other of others) {
      updateJob(other.id, { is_active: 0 });
    }

    merged += 1;
    deactivated += others.length;
  }

  console.log(`[Dedup] Done: ${merged} groups merged, ${deactivated} duplicates deactivated`);
  return { merged, deactivated };
}
