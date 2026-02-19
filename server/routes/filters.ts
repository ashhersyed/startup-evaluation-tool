import { Router, Request, Response } from 'express';
import {
  getActiveJobs,
  getCompanyById,
  getAllCompanies,
  getStats,
} from '../db/store.js';

const router = Router();

// Canonical funding stage sort order
const FUNDING_STAGE_ORDER: Record<string, number> = {
  'Pre-Seed': 1,
  'Seed': 2,
  'Series A': 3,
  'Series B': 4,
  'Series C': 5,
  'Series D': 6,
  'Series E+': 7,
  'Growth': 8,
  'Public': 9,
};

// GET /api/filters - Available filter values
router.get('/', (_req: Request, res: Response) => {
  try {
    const activeJobs = getActiveJobs();
    const allCompanies = getAllCompanies();

    // Build a set of company IDs that have active jobs
    const companyIdsWithJobs = new Set(activeJobs.map(j => j.company_id));

    // Companies that have at least one active job
    const companiesWithJobs = allCompanies.filter(c => companyIdsWithJobs.has(c.id));

    // --- Funding stages ---
    const fundingStageSet = new Set<string>();
    for (const c of companiesWithJobs) {
      if (c.funding_stage != null) {
        fundingStageSet.add(c.funding_stage);
      }
    }
    const fundingStages = Array.from(fundingStageSet).sort(
      (a, b) => (FUNDING_STAGE_ORDER[a] ?? 10) - (FUNDING_STAGE_ORDER[b] ?? 10)
    );

    // --- Top VCs / Investors ---
    const vcCounts = new Map<string, number>();
    for (const c of companiesWithJobs) {
      if (!c.investors || c.investors === '[]') continue;
      try {
        const investors = JSON.parse(c.investors) as string[];
        for (const inv of investors) {
          const name = inv.trim();
          if (name) {
            vcCounts.set(name, (vcCounts.get(name) || 0) + 1);
          }
        }
      } catch { /* skip invalid JSON */ }
    }
    const vcs = Array.from(vcCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([name, count]) => ({ name, count }));

    // --- Company size ranges (static) ---
    const companySizes = [
      { label: 'Early Stage (1-10)', min: 1, max: 10 },
      { label: 'Small (11-50)', min: 11, max: 50 },
      { label: 'Medium (51-200)', min: 51, max: 200 },
      { label: 'Large (201-500)', min: 201, max: 500 },
      { label: 'Enterprise (500+)', min: 500, max: 100000 },
    ];

    // --- Top locations ---
    const locationCounts = new Map<string, number>();
    for (const j of activeJobs) {
      if (j.location != null && j.location !== '') {
        locationCounts.set(j.location, (locationCounts.get(j.location) || 0) + 1);
      }
    }
    const locations = Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name, count]) => ({ name, count }));

    // --- Sources ---
    const sourceCounts = new Map<string, number>();
    for (const j of activeJobs) {
      sourceCounts.set(j.source, (sourceCounts.get(j.source) || 0) + 1);
    }
    const sources = Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    // --- Industries ---
    const industrySet = new Set<string>();
    for (const c of companiesWithJobs) {
      if (c.industry != null) {
        industrySet.add(c.industry);
      }
    }
    const industries = Array.from(industrySet).sort();

    res.json({
      funding_stages: fundingStages,
      vcs,
      company_sizes: companySizes,
      locations,
      sources,
      industries,
    });
  } catch (err: any) {
    console.error('[Filters API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

// GET /api/stats - Dashboard statistics
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err: any) {
    console.error('[Stats API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
