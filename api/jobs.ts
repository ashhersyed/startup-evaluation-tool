import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getActiveJobs,
  getJobById,
  getCompanyById,
  getJobsByCompany,
  searchJobs as searchJobsFTS,
} from '../server/db/store.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if this is a single job request: /api/jobs?id=123
    const jobId = req.query.id as string | undefined;
    if (jobId) {
      return handleSingleJob(parseInt(jobId), res);
    }

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

    let matchedIds: Set<number> | null = null;
    if (q && q.trim()) {
      matchedIds = new Set(searchJobsFTS(q.trim()));
    }

    let jobs = getActiveJobs();

    if (matchedIds !== null) {
      jobs = jobs.filter(j => matchedIds!.has(j.id));
    }

    const companyCache = new Map<number, ReturnType<typeof getCompanyById>>();
    function getCompanyCached(id: number) {
      if (!companyCache.has(id)) {
        companyCache.set(id, getCompanyById(id));
      }
      return companyCache.get(id);
    }

    if (funding_stage) {
      const stages = funding_stage.split(',').map(s => s.trim().toLowerCase());
      jobs = jobs.filter(j => {
        const c = getCompanyCached(j.company_id);
        return c?.funding_stage && stages.includes(c.funding_stage.toLowerCase());
      });
    }

    if (vc) {
      const vcs = vc.split(',').map(v => v.trim().toLowerCase());
      jobs = jobs.filter(j => {
        const c = getCompanyCached(j.company_id);
        if (!c) return false;
        try {
          const investors = JSON.parse(c.investors || '[]') as string[];
          return vcs.some(v => investors.some(inv => inv.toLowerCase().includes(v)));
        } catch { return false; }
      });
    }

    if (company_size) {
      const sizes = company_size.split(',');
      jobs = jobs.filter(j => {
        const c = getCompanyCached(j.company_id);
        if (!c) return false;
        return sizes.some(size => {
          if (size.endsWith('+')) {
            return c.headcount_min != null && c.headcount_min >= parseInt(size);
          }
          const [min, max] = size.split('-').map(Number);
          if (min && max) {
            return (c.headcount_min != null && c.headcount_min >= min) &&
                   (c.headcount_max != null && c.headcount_max <= max);
          }
          return false;
        });
      });
    }

    if (posted_within) {
      const daysMap: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '60d': 60 };
      const days = daysMap[posted_within];
      if (days) {
        const cutoff = new Date(Date.now() - days * 86400000).toISOString();
        jobs = jobs.filter(j => j.posted_at != null && j.posted_at > cutoff);
      }
    }

    if (location) {
      const loc = location.toLowerCase();
      jobs = jobs.filter(j => {
        const c = getCompanyCached(j.company_id);
        return (j.location && j.location.toLowerCase().includes(loc)) ||
               (c?.location && c.location.toLowerCase().includes(loc));
      });
    }

    if (remote === 'true') {
      jobs = jobs.filter(j => j.remote_type === 'remote');
    }

    if (source) {
      const sources = source.split(',').map(s => s.trim());
      jobs = jobs.filter(j => sources.includes(j.source));
    }

    if (industry) {
      const industries = industry.split(',').map(i => i.trim().toLowerCase());
      jobs = jobs.filter(j => {
        const c = getCompanyCached(j.company_id);
        return c?.industry && industries.some(ind => c.industry!.toLowerCase().includes(ind));
      });
    }

    // Sort
    switch (sort) {
      case 'relevance':
        if (matchedIds !== null) {
          const idOrder = searchJobsFTS(q!.trim());
          const orderMap = new Map(idOrder.map((id, idx) => [id, idx]));
          jobs.sort((a, b) => (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity));
        } else {
          jobs.sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''));
        }
        break;
      case 'company_size':
        jobs.sort((a, b) => {
          const ca = getCompanyCached(a.company_id);
          const cb = getCompanyCached(b.company_id);
          return (cb?.headcount_max ?? -1) - (ca?.headcount_max ?? -1);
        });
        break;
      case 'date':
      default:
        jobs.sort((a, b) => (b.posted_at || '').localeCompare(a.posted_at || ''));
    }

    const total = jobs.length;
    const offset = (pageNum - 1) * limitNum;
    const paged = jobs.slice(offset, offset + limitNum);

    const allActive = getActiveJobs();
    const dedupCounts = new Map<string, number>();
    for (const j of allActive) {
      dedupCounts.set(j.dedup_hash, (dedupCounts.get(j.dedup_hash) || 0) + 1);
    }

    const parsedJobs = paged.map(j => {
      const c = getCompanyCached(j.company_id);
      return {
        ...j,
        company_name: c?.name ?? null,
        company_website: c?.website ?? null,
        company_logo: c?.logo_url ?? null,
        company_funding_stage: c?.funding_stage ?? null,
        company_headcount_min: c?.headcount_min ?? null,
        company_headcount_max: c?.headcount_max ?? null,
        company_investors: c ? JSON.parse(c.investors || '[]') : [],
        company_location: c?.location ?? null,
        company_industry: c?.industry ?? null,
        merged_from: JSON.parse(j.merged_from || '[]'),
        source_count: dedupCounts.get(j.dedup_hash) || 1,
      };
    });

    return res.json({
      jobs: parsedJobs,
      total,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(total / limitNum),
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch jobs' });
  }
}

function handleSingleJob(id: number, res: VercelResponse) {
  const job = getJobById(id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const company = getCompanyById(job.company_id);
  const jobResponse = {
    ...job,
    company_name: company?.name ?? null,
    company_website: company?.website ?? null,
    company_logo: company?.logo_url ?? null,
    company_description: company?.description ?? null,
    company_funding_stage: company?.funding_stage ?? null,
    company_total_raised: company?.total_raised ?? null,
    company_headcount_min: company?.headcount_min ?? null,
    company_headcount_max: company?.headcount_max ?? null,
    company_investors: company ? JSON.parse(company.investors || '[]') : [],
    company_location: company?.location ?? null,
    company_founded_year: company?.founded_year ?? null,
    company_industry: company?.industry ?? null,
    merged_from: JSON.parse(job.merged_from || '[]'),
  };

  const relatedJobs = getJobsByCompany(job.company_id)
    .filter(j => j.id !== job.id)
    .slice(0, 5)
    .map(j => ({
      id: j.id,
      title: j.title,
      location: j.location,
      remote_type: j.remote_type,
      posted_at: j.posted_at,
    }));

  return res.json({ job: jobResponse, related_jobs: relatedJobs });
}
