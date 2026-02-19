import { Router, Request, Response } from 'express';
import {
  getAllCompanies,
  getCompanyById,
  getJobsByCompany,
  getFundingByCompany,
} from '../db/store.js';

const router = Router();

// GET /api/companies - List companies with filters
router.get('/', (req: Request, res: Response) => {
  try {
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

    let companies = getAllCompanies();

    // Precompute active job counts per company
    const activeJobCounts = new Map<number, number>();
    for (const c of companies) {
      activeJobCounts.set(c.id, getJobsByCompany(c.id).length);
    }

    // Apply filters
    if (funding_stage) {
      const stages = funding_stage.split(',').map(s => s.trim().toLowerCase());
      companies = companies.filter(c =>
        c.funding_stage != null && stages.includes(c.funding_stage.toLowerCase())
      );
    }

    if (vc) {
      const vcs = vc.split(',').map(v => v.trim().toLowerCase());
      companies = companies.filter(c => {
        try {
          const investors = JSON.parse(c.investors || '[]') as string[];
          const investorsLower = investors.map(i => i.toLowerCase());
          return vcs.some(v => investorsLower.some(inv => inv.includes(v)));
        } catch {
          return false;
        }
      });
    }

    if (company_size) {
      const sizes = company_size.split(',');
      companies = companies.filter(c => {
        return sizes.some(size => {
          const [min, max] = size.split('-').map(Number);
          if (min && max) {
            return (c.headcount_min != null && c.headcount_min >= min) &&
                   (c.headcount_max != null && c.headcount_max <= max);
          }
          return false;
        });
      });
    }

    if (location) {
      const loc = location.toLowerCase();
      companies = companies.filter(c =>
        c.location != null && c.location.toLowerCase().includes(loc)
      );
    }

    if (industry) {
      const ind = industry.toLowerCase();
      companies = companies.filter(c =>
        c.industry != null && c.industry.toLowerCase().includes(ind)
      );
    }

    // Sort
    switch (sort) {
      case 'name':
        companies.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'funded':
        companies.sort((a, b) => {
          const dateA = a.last_funding_date || '';
          const dateB = b.last_funding_date || '';
          return dateB.localeCompare(dateA);
        });
        break;
      case 'jobs':
      default:
        companies.sort((a, b) => {
          const jobsDiff = (activeJobCounts.get(b.id) || 0) - (activeJobCounts.get(a.id) || 0);
          if (jobsDiff !== 0) return jobsDiff;
          return a.name.localeCompare(b.name);
        });
    }

    const total = companies.length;
    const offset = (pageNum - 1) * limitNum;
    const paged = companies.slice(offset, offset + limitNum);

    const parsed = paged.map(c => ({
      ...c,
      investors: JSON.parse(c.investors || '[]'),
      active_jobs: activeJobCounts.get(c.id) || 0,
    }));

    res.json({
      companies: parsed,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    console.error('[Companies API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// GET /api/companies/:id - Company detail with all jobs
router.get('/:id', (req: Request, res: Response) => {
  try {
    const company = getCompanyById(parseInt(req.params.id));

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const companyResponse = {
      ...company,
      investors: JSON.parse(company.investors || '[]'),
    };

    const jobs = getJobsByCompany(company.id)
      .sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''));

    const fundingEvents = getFundingByCompany(company.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(fe => ({
        ...fe,
        investors: JSON.parse(fe.investors || '[]'),
      }));

    res.json({ company: companyResponse, jobs, funding_events: fundingEvents });
  } catch (err: any) {
    console.error('[Companies API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

export default router;
