import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron request
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cronPath = (req.query.path as string) || '';

  try {
    switch (cronPath) {
      // Run a single tier of scrapers (fits within 10s timeout)
      case 'scrape-tier1': {
        const { runAllScrapers } = await import('../server/scrapers/registry.js');
        const result = await runAllScrapers({ tier: 1 });
        return res.json({ status: 'success', tier: 1, ...result });
      }

      case 'scrape-tier2a': {
        const { runAllScrapers } = await import('../server/scrapers/registry.js');
        const names = ['a16z', 'sequoia', 'accel', 'greylock', 'kleiner', 'lightspeed', 'index-ventures'];
        const result = await runAllScrapers({ names });
        return res.json({ status: 'success', tier: '2a', ...result });
      }

      case 'scrape-tier2b': {
        const { runAllScrapers } = await import('../server/scrapers/registry.js');
        const names = ['general-catalyst', 'bessemer', 'nea', 'insight', 'khosla', 'thrive', 'battery'];
        const result = await runAllScrapers({ names });
        return res.json({ status: 'success', tier: '2b', ...result });
      }

      case 'scrape-tier3': {
        const { runAllScrapers } = await import('../server/scrapers/registry.js');
        const result = await runAllScrapers({ tier: 3 });
        return res.json({ status: 'success', tier: 3, ...result });
      }

      case 'scrape-tier4': {
        const { runAllScrapers } = await import('../server/scrapers/registry.js');
        const result = await runAllScrapers({ tier: 4 });
        return res.json({ status: 'success', tier: 4, ...result });
      }

      case 'scrape-tier5': {
        const { runAllScrapers } = await import('../server/scrapers/registry.js');
        const result = await runAllScrapers({ tier: 5 });
        return res.json({ status: 'success', tier: 5, ...result });
      }

      // Run a single scraper by name: ?path=scrape-one&name=greenhouse
      case 'scrape-one': {
        const name = req.query.name as string;
        if (!name) {
          return res.status(400).json({ error: 'Missing ?name= parameter' });
        }
        const { getRegistry, runScraper } = await import('../server/scrapers/registry.js');
        const entry = getRegistry().find(e => e.name === name);
        if (!entry) {
          return res.status(404).json({ error: `Scraper "${name}" not found` });
        }
        const result = await runScraper(entry);
        return res.json({ status: 'success', scraper: name, ...result });
      }

      // Legacy: run ALL scrapers (may timeout on Hobby plan)
      case 'scrape': {
        const { runAllScrapers } = await import('../server/scrapers/registry.js');
        const { runDedup } = await import('../server/agents/dedup.js');
        const result = await runAllScrapers();
        await runDedup();
        return res.json({ status: 'success', ...result });
      }

      case 'freshness': {
        const { runFreshnessCheck } = await import('../server/agents/freshness.js');
        const result = await runFreshnessCheck();
        return res.json({ status: 'success', ...result });
      }

      case 'funding': {
        const { runFundingTracker } = await import('../server/agents/funding-tracker.js');
        const result = await runFundingTracker();
        return res.json({ status: 'success', ...result });
      }

      case 'cleanup': {
        const { runFreshnessCheck } = await import('../server/agents/freshness.js');
        const { runDedup } = await import('../server/agents/dedup.js');
        await runFreshnessCheck();
        await runDedup();
        return res.json({ status: 'success', action: 'cleanup' });
      }

      // Status: show scrape logs and job counts
      case 'status': {
        const { ensureStoreReady, getScrapeLogsBySource, getActiveJobs } = await import('../server/db/store.js');
        await ensureStoreReady();
        const logs = getScrapeLogsBySource(undefined, 50);
        const activeJobs = getActiveJobs();
        return res.json({
          status: 'ok',
          total_active_jobs: activeJobs.length,
          recent_scrape_logs: logs,
        });
      }

      default:
        return res.status(404).json({ error: 'Unknown cron job', available: [
          'scrape-tier1', 'scrape-tier2a', 'scrape-tier2b', 'scrape-tier3', 'scrape-tier4', 'scrape-tier5',
          'scrape-one&name=SCRAPER_NAME', 'scrape', 'status', 'freshness', 'funding', 'cleanup'
        ]});
    }
  } catch (err: any) {
    console.error(`[Cron] Error in ${cronPath}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
