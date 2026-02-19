import { Router, Request, Response } from 'express';
import { getScrapeLogsBySource } from '../db/store.js';
import { triggerFullScrape, triggerScraper, triggerFreshnessCheck, triggerFundingTracker, triggerDedup } from '../agents/scheduler.js';

const router = Router();

// Simple API key auth for admin endpoints
function requireAdmin(req: Request, res: Response, next: Function) {
  const apiKey = req.headers['x-admin-key'] || req.query.admin_key;
  const expectedKey = process.env.ADMIN_API_KEY;

  // If no admin key configured, allow access (dev mode)
  if (!expectedKey) {
    return next();
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.use(requireAdmin);

// POST /api/admin/scrape - Trigger full scrape
router.post('/scrape', async (_req: Request, res: Response) => {
  try {
    res.json({ message: 'Full scrape triggered', status: 'running' });
    // Run in background
    triggerFullScrape().catch(err => console.error('[Admin] Scrape error:', err.message));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/scrape/:name - Trigger specific scraper
router.post('/scrape/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    res.json({ message: `Scraper ${name} triggered`, status: 'running' });
    triggerScraper(name).catch(err => console.error(`[Admin] Scraper ${name} error:`, err.message));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/freshness - Trigger freshness check
router.post('/freshness', async (_req: Request, res: Response) => {
  try {
    res.json({ message: 'Freshness check triggered', status: 'running' });
    triggerFreshnessCheck().catch(err => console.error('[Admin] Freshness error:', err.message));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/funding - Trigger funding tracker
router.post('/funding', async (_req: Request, res: Response) => {
  try {
    res.json({ message: 'Funding tracker triggered', status: 'running' });
    triggerFundingTracker().catch(err => console.error('[Admin] Funding error:', err.message));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/dedup - Trigger dedup
router.post('/dedup', async (_req: Request, res: Response) => {
  try {
    res.json({ message: 'Dedup triggered', status: 'running' });
    triggerDedup().catch(err => console.error('[Admin] Dedup error:', err.message));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/logs - View scrape logs
router.get('/logs', (req: Request, res: Response) => {
  try {
    const { source, limit = '50' } = req.query as Record<string, string>;
    const limitNum = parseInt(limit) || 50;

    const logs = getScrapeLogsBySource(source || undefined, limitNum);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
