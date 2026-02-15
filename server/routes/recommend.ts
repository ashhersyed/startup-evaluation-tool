import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema.js';

const router = Router();

// GET /api/recommend - Top 10 company recommendations
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { funding_stage, vc, remote, company_size } = req.query as Record<string, string>;

    let conditions: string[] = [];
    let params: any[] = [];

    if (funding_stage) {
      const stages = funding_stage.split(',').map(s => s.trim());
      conditions.push(`c.funding_stage IN (${stages.map(() => '?').join(',')})`);
      params.push(...stages);
    }

    if (vc) {
      const vcs = vc.split(',').map(v => v.trim().toLowerCase());
      const vcConditions = vcs.map(() => `LOWER(c.investors) LIKE ?`);
      conditions.push(`(${vcConditions.join(' OR ')})`);
      params.push(...vcs.map(v => `%${v}%`));
    }

    if (remote === 'true') {
      conditions.push(`EXISTS (
        SELECT 1 FROM jobs j2 WHERE j2.company_id = c.id AND j2.is_active = 1 AND j2.remote_type = 'remote'
      )`);
    }

    if (company_size) {
      const sizes = company_size.split(',');
      const sizeConditions: string[] = [];
      for (const size of sizes) {
        const [min, max] = size.split('-').map(Number);
        if (min && max) {
          sizeConditions.push(`(c.headcount_min >= ? AND c.headcount_max <= ?)`);
          params.push(min, max);
        }
      }
      if (sizeConditions.length) {
        conditions.push(`(${sizeConditions.join(' OR ')})`);
      }
    }

    const where = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

    // Score companies based on:
    // - active_jobs (25%) - more jobs = more hiring
    // - funding_recency (25%) - funded recently = growing
    // - job_freshness (20%) - recent postings
    // - source_diversity (15%) - found on multiple sources = legit
    // - data_completeness (15%) - has salary, description, etc.
    const companies = db.prepare(`
      SELECT
        c.*,
        COUNT(j.id) as active_jobs,
        AVG(CASE
          WHEN j.posted_at IS NOT NULL
          THEN julianday('now') - julianday(j.posted_at)
          ELSE 30
        END) as avg_job_age_days,
        MAX(j.posted_at) as latest_job_posted,
        SUM(CASE WHEN j.salary_min IS NOT NULL THEN 1 ELSE 0 END) as jobs_with_salary,
        SUM(CASE WHEN j.description IS NOT NULL AND LENGTH(j.description) > 100 THEN 1 ELSE 0 END) as jobs_with_desc,
        (SELECT COUNT(DISTINCT j3.source) FROM jobs j3 WHERE j3.company_id = c.id AND j3.is_active = 1) as source_count,
        (SELECT MAX(fe.date) FROM funding_events fe WHERE fe.company_id = c.id) as latest_funding_date
      FROM companies c
      JOIN jobs j ON j.company_id = c.id AND j.is_active = 1
      WHERE 1=1 ${where}
      GROUP BY c.id
      HAVING active_jobs >= 1
      ORDER BY active_jobs DESC
      LIMIT 100
    `).all(...params) as any[];

    // Calculate composite scores
    const scored = companies.map(c => {
      const activeJobsScore = Math.min(c.active_jobs / 20, 1) * 25;

      // Funding recency (0-25): higher if funded within last 6 months
      let fundingScore = 0;
      if (c.latest_funding_date) {
        const daysSinceFunding = (Date.now() - new Date(c.latest_funding_date).getTime()) / (1000 * 60 * 60 * 24);
        fundingScore = Math.max(0, 1 - daysSinceFunding / 180) * 25;
      }

      // Job freshness (0-20): lower avg age is better
      const freshnessScore = Math.max(0, 1 - (c.avg_job_age_days || 30) / 60) * 20;

      // Source diversity (0-15)
      const sourceScore = Math.min(c.source_count / 4, 1) * 15;

      // Data completeness (0-15)
      const totalJobs = c.active_jobs || 1;
      const completeness = ((c.jobs_with_salary / totalJobs) * 0.5 + (c.jobs_with_desc / totalJobs) * 0.5);
      const completenessScore = completeness * 15;

      const totalScore = activeJobsScore + fundingScore + freshnessScore + sourceScore + completenessScore;

      // Generate reasons
      const reasons: string[] = [];
      if (c.active_jobs >= 10) reasons.push(`Actively hiring with ${c.active_jobs} open roles`);
      else if (c.active_jobs >= 3) reasons.push(`${c.active_jobs} open positions`);
      if (fundingScore > 15) reasons.push('Recently funded — likely in growth mode');
      if (c.source_count >= 3) reasons.push(`Listed on ${c.source_count} job sources`);
      if (c.avg_job_age_days < 7) reasons.push('Posting new jobs frequently');
      if (c.funding_stage) reasons.push(`${c.funding_stage} stage`);

      return {
        company: {
          ...c,
          investors: JSON.parse(c.investors || '[]'),
        },
        score: Math.round(totalScore * 10) / 10,
        reasons,
        active_jobs_count: c.active_jobs,
      };
    });

    // Sort by score and take top 10
    scored.sort((a, b) => b.score - a.score);
    const top10 = scored.slice(0, 10);

    // Fetch recent jobs for each recommended company
    for (const rec of top10) {
      rec.recent_jobs = db.prepare(`
        SELECT id, title, location, remote_type, posted_at, salary_min, salary_max
        FROM jobs
        WHERE company_id = ? AND is_active = 1
        ORDER BY posted_at DESC NULLS LAST
        LIMIT 5
      `).all(rec.company.id) as any[];
    }

    res.json({ recommendations: top10 });
  } catch (err: any) {
    console.error('[Recommend API] Error:', err.message);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

export default router;
