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

      default:
        return res.status(404).json({ error: 'Unknown cron job' });
    }
  } catch (err: any) {
    console.error(`[Cron] Error in ${cronPath}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}
