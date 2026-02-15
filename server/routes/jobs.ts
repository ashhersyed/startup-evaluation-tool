import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema.js';

const router = Router();

// GET /api/jobs - List jobs with filters and pagination
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      q,
      funding_stage,
      vc,
      company_size,
      posted_within,
      location,
      remote,
      source,
      industry,
      sort = 'date',
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let conditions: string[] = ['j.is_active = 1'];
    let params: any[] = [];

    // Full-text search
    if (q && q.trim()) {
      conditions.push(`j.id IN (
        SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?
      )`);
      // FTS5 query: prefix matching with *
      const ftsQuery = q.trim().split(/\s+/).map(w => `"${w}"*`).join(' ');
      params.push(ftsQuery);
    }

    // Funding stage filter
    if (funding_stage) {
      const stages = funding_stage.split(',').map(s => s.trim());
      conditions.push(`c.funding_stage IN (${stages.map(() => '?').join(',')})`);
      params.push(...stages);
    }

    // VC/Investor filter
    if (vc) {
      const vcs = vc.split(',').map(v => v.trim().toLowerCase());
      const vcConditions = vcs.map(() => `LOWER(c.investors) LIKE ?`);
      conditions.push(`(${vcConditions.join(' OR ')})`);
      params.push(...vcs.map(v => `%${v}%`));
    }

    // Company size filter
    if (company_size) {
      const sizes = company_size.split(',');
      const sizeConditions: string[] = [];
      for (const size of sizes) {
        const [min, max] = size.split('-').map(Number);
        if (min && max) {
          sizeConditions.push(`(c.headcount_min >= ? AND c.headcount_max <= ?)`);
          params.push(min, max);
        } else if (size.endsWith('+')) {
          const threshold = parseInt(size);
          sizeConditions.push(`c.headcount_min >= ?`);
          params.push(threshold);
        }
      }
      if (sizeConditions.length > 0) {
        conditions.push(`(${sizeConditions.join(' OR ')})`);
      }
    }

    // Posted within filter
    if (posted_within) {
      const daysMap: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '60d': 60 };
      const days = daysMap[posted_within];
      if (days) {
        conditions.push(`j.posted_at > datetime('now', '-${days} days')`);
      }
    }

    // Location filter
    if (location) {
      conditions.push(`(LOWER(j.location) LIKE ? OR LOWER(c.location) LIKE ?)`);
      params.push(`%${location.toLowerCase()}%`, `%${location.toLowerCase()}%`);
    }

    // Remote filter
    if (remote === 'true') {
      conditions.push(`j.remote_type = 'remote'`);
    }

    // Source filter
    if (source) {
      const sources = source.split(',').map(s => s.trim());
      conditions.push(`j.source IN (${sources.map(() => '?').join(',')})`);
      params.push(...sources);
    }

    // Industry filter
    if (industry) {
      const industries = industry.split(',').map(i => i.trim().toLowerCase());
      const indConditions = industries.map(() => `LOWER(c.industry) LIKE ?`);
      conditions.push(`(${indConditions.join(' OR ')})`);
      params.push(...industries.map(i => `%${i}%`));
    }

    const where = conditions.join(' AND ');

    // Sort order
    let orderBy: string;
    switch (sort) {
      case 'relevance':
        orderBy = q ? 'ORDER BY rank' : 'ORDER BY j.posted_at DESC';
        break;
      case 'company_size':
        orderBy = 'ORDER BY c.headcount_max DESC NULLS LAST, j.posted_at DESC';
        break;
      case 'date':
      default:
        orderBy = 'ORDER BY j.posted_at DESC NULLS LAST, j.created_at DESC';
    }

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE ${where}
    `).get(...params) as { total: number };

    // Get jobs with company data
    const jobs = db.prepare(`
      SELECT
        j.*,
        c.name as company_name,
        c.website as company_website,
        c.logo_url as company_logo,
        c.funding_stage as company_funding_stage,
        c.headcount_min as company_headcount_min,
        c.headcount_max as company_headcount_max,
        c.investors as company_investors,
        c.location as company_location,
        c.industry as company_industry,
        (SELECT COUNT(*) FROM jobs j2 WHERE j2.dedup_hash = j.dedup_hash) as source_count
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset) as any[];

    // Parse JSON fields
    const parsedJobs = jobs.map(j => ({
      ...j,
      company_investors: JSON.parse(j.company_investors || '[]'),
      merged_from: JSON.parse(j.merged_from || '[]'),
    }));

    res.json({
      jobs: parsedJobs,
      total: countResult.total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(countResult.total / limitNum),
    });
  } catch (err: any) {
    console.error('[Jobs API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id - Single job detail
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const job = db.prepare(`
      SELECT
        j.*,
        c.name as company_name,
        c.website as company_website,
        c.logo_url as company_logo,
        c.description as company_description,
        c.funding_stage as company_funding_stage,
        c.total_raised as company_total_raised,
        c.headcount_min as company_headcount_min,
        c.headcount_max as company_headcount_max,
        c.investors as company_investors,
        c.location as company_location,
        c.founded_year as company_founded_year,
        c.industry as company_industry
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      WHERE j.id = ?
    `).get(req.params.id) as any;

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    job.company_investors = JSON.parse(job.company_investors || '[]');
    job.merged_from = JSON.parse(job.merged_from || '[]');

    // Get related jobs from same company
    const relatedJobs = db.prepare(`
      SELECT id, title, location, remote_type, posted_at
      FROM jobs
      WHERE company_id = ? AND id != ? AND is_active = 1
      LIMIT 5
    `).all(job.company_id, job.id);

    res.json({ job, related_jobs: relatedJobs });
  } catch (err: any) {
    console.error('[Jobs API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

export default router;
