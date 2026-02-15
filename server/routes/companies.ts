import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema.js';

const router = Router();

// GET /api/companies - List companies with filters
router.get('/', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      funding_stage,
      vc,
      company_size,
      location,
      industry,
      sort = 'jobs',
      page = '1',
      limit = '20',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

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

    if (location) {
      conditions.push(`LOWER(c.location) LIKE ?`);
      params.push(`%${location.toLowerCase()}%`);
    }

    if (industry) {
      conditions.push(`LOWER(c.industry) LIKE ?`);
      params.push(`%${industry.toLowerCase()}%`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    let orderBy: string;
    switch (sort) {
      case 'name':
        orderBy = 'ORDER BY c.name ASC';
        break;
      case 'funded':
        orderBy = 'ORDER BY c.last_funding_date DESC NULLS LAST';
        break;
      case 'jobs':
      default:
        orderBy = 'ORDER BY active_jobs DESC, c.name ASC';
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM companies c ${where}
    `).get(...params) as { total: number };

    const companies = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM jobs j WHERE j.company_id = c.id AND j.is_active = 1) as active_jobs
      FROM companies c
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset) as any[];

    const parsed = companies.map(c => ({
      ...c,
      investors: JSON.parse(c.investors || '[]'),
    }));

    res.json({
      companies: parsed,
      total: countResult.total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(countResult.total / limitNum),
    });
  } catch (err: any) {
    console.error('[Companies API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// GET /api/companies/:id - Company detail with all jobs
router.get('/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id) as any;

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    company.investors = JSON.parse(company.investors || '[]');

    const jobs = db.prepare(`
      SELECT * FROM jobs WHERE company_id = ? AND is_active = 1 ORDER BY posted_at DESC
    `).all(company.id);

    const fundingEvents = db.prepare(`
      SELECT * FROM funding_events WHERE company_id = ? ORDER BY date DESC
    `).all(company.id) as any[];

    for (const fe of fundingEvents) {
      fe.investors = JSON.parse(fe.investors || '[]');
    }

    res.json({ company, jobs, funding_events: fundingEvents });
  } catch (err: any) {
    console.error('[Companies API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

export default router;
