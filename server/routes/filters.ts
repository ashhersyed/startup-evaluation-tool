import { Router, Request, Response } from 'express';
import { getDb } from '../db/schema.js';

const router = Router();

// GET /api/filters - Available filter values
router.get('/', (_req: Request, res: Response) => {
  try {
    const db = getDb();

    // Get distinct funding stages
    const fundingStages = db.prepare(`
      SELECT DISTINCT c.funding_stage
      FROM companies c
      JOIN jobs j ON j.company_id = c.id AND j.is_active = 1
      WHERE c.funding_stage IS NOT NULL
      ORDER BY CASE c.funding_stage
        WHEN 'Pre-Seed' THEN 1
        WHEN 'Seed' THEN 2
        WHEN 'Series A' THEN 3
        WHEN 'Series B' THEN 4
        WHEN 'Series C' THEN 5
        WHEN 'Series D' THEN 6
        WHEN 'Series E+' THEN 7
        WHEN 'Growth' THEN 8
        WHEN 'Public' THEN 9
        ELSE 10
      END
    `).all() as { funding_stage: string }[];

    // Get top VCs/investors
    const companies = db.prepare(`
      SELECT c.investors
      FROM companies c
      JOIN jobs j ON j.company_id = c.id AND j.is_active = 1
      WHERE c.investors != '[]' AND c.investors IS NOT NULL
    `).all() as { investors: string }[];

    const vcCounts = new Map<string, number>();
    for (const c of companies) {
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

    // Company size ranges
    const companySizes = [
      { label: 'Early Stage (1-10)', min: 1, max: 10 },
      { label: 'Small (11-50)', min: 11, max: 50 },
      { label: 'Medium (51-200)', min: 51, max: 200 },
      { label: 'Large (201-500)', min: 201, max: 500 },
      { label: 'Enterprise (500+)', min: 500, max: 100000 },
    ];

    // Top locations
    const locations = db.prepare(`
      SELECT j.location, COUNT(*) as cnt
      FROM jobs j
      WHERE j.is_active = 1 AND j.location IS NOT NULL AND j.location != ''
      GROUP BY j.location
      ORDER BY cnt DESC
      LIMIT 30
    `).all() as { location: string; cnt: number }[];

    // Sources
    const sources = db.prepare(`
      SELECT source, COUNT(*) as cnt
      FROM jobs
      WHERE is_active = 1
      GROUP BY source
      ORDER BY cnt DESC
    `).all() as { source: string; cnt: number }[];

    // Industries
    const industries = db.prepare(`
      SELECT DISTINCT c.industry
      FROM companies c
      JOIN jobs j ON j.company_id = c.id AND j.is_active = 1
      WHERE c.industry IS NOT NULL
      ORDER BY c.industry
    `).all() as { industry: string }[];

    res.json({
      funding_stages: fundingStages.map(f => f.funding_stage),
      vcs,
      company_sizes: companySizes,
      locations: locations.map(l => ({ name: l.location, count: l.cnt })),
      sources: sources.map(s => ({ name: s.source, count: s.cnt })),
      industries: industries.map(i => i.industry),
    });
  } catch (err: any) {
    console.error('[Filters API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

// GET /api/stats - Dashboard statistics
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getDb();

    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM jobs WHERE is_active = 1) as total_active_jobs,
        (SELECT COUNT(DISTINCT company_id) FROM jobs WHERE is_active = 1) as total_companies,
        (SELECT COUNT(DISTINCT source) FROM jobs WHERE is_active = 1) as sources_count,
        (SELECT MAX(scraped_at) FROM jobs) as last_updated,
        (SELECT COUNT(*) FROM jobs WHERE is_active = 1 AND created_at > datetime('now', '-1 day')) as jobs_added_24h,
        (SELECT COUNT(*) FROM jobs WHERE is_active = 1 AND created_at > datetime('now', '-7 days')) as jobs_added_7d
    `).get() as any;

    res.json(stats);
  } catch (err: any) {
    console.error('[Stats API] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
