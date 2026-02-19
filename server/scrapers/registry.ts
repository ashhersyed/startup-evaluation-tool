import { BaseScraper, ScraperResult, upsertCompany, upsertJob, logScrape } from './base.js';

// Tier 1 - Job Boards
import HNHiringScraper from './job-boards/hn-hiring.js';
import RemoteOKScraper from './job-boards/remoteok.js';
import YCScraper from './job-boards/yc.js';
import WellfoundScraper from './job-boards/wellfound.js';
import BuiltInScraper from './job-boards/builtin.js';

// Tier 2 - VC Boards
import A16ZScraper from './vc-boards/a16z.js';
import SequoiaScraper from './vc-boards/sequoia.js';
import AccelScraper from './vc-boards/accel.js';
import GreylockScraper from './vc-boards/greylock.js';
import KleinerScraper from './vc-boards/kleiner.js';
import LightspeedScraper from './vc-boards/lightspeed.js';
import IndexVenturesScraper from './vc-boards/index-ventures.js';
import GeneralCatalystScraper from './vc-boards/general-catalyst.js';
import BessemerScraper from './vc-boards/bessemer.js';
import NEAScraper from './vc-boards/nea.js';
import InsightScraper from './vc-boards/insight.js';
import KhoslaScraper from './vc-boards/khosla.js';
import ThriveScraper from './vc-boards/thrive.js';
import BatteryScraper from './vc-boards/battery.js';

// Tier 3 - ATS
import GreenhouseScraper from './ats/greenhouse.js';
import LeverScraper from './ats/lever.js';

// Tier 4 - Aggregators
import TopStartupsScraper from './aggregators/topstartups.js';
import TrueUpScraper from './aggregators/trueup.js';

// Tier 5 - Funding
import TechCrunchRSSScraper from './funding/techcrunch-rss.js';

export interface ScraperRegistry {
  name: string;
  scraper: BaseScraper;
  tier: number;
  enabled: boolean;
}

function createRegistry(): ScraperRegistry[] {
  return [
    // Tier 1 - High volume job boards
    { name: 'hn-hiring', scraper: new HNHiringScraper(), tier: 1, enabled: true },
    { name: 'remoteok', scraper: new RemoteOKScraper(), tier: 1, enabled: true },
    { name: 'yc', scraper: new YCScraper(), tier: 1, enabled: true },
    { name: 'wellfound', scraper: new WellfoundScraper(), tier: 1, enabled: true },
    { name: 'builtin', scraper: new BuiltInScraper(), tier: 1, enabled: true },

    // Tier 2 - VC portfolio boards
    { name: 'a16z', scraper: new A16ZScraper(), tier: 2, enabled: true },
    { name: 'sequoia', scraper: new SequoiaScraper(), tier: 2, enabled: true },
    { name: 'accel', scraper: new AccelScraper(), tier: 2, enabled: true },
    { name: 'greylock', scraper: new GreylockScraper(), tier: 2, enabled: true },
    { name: 'kleiner', scraper: new KleinerScraper(), tier: 2, enabled: true },
    { name: 'lightspeed', scraper: new LightspeedScraper(), tier: 2, enabled: true },
    { name: 'index-ventures', scraper: new IndexVenturesScraper(), tier: 2, enabled: true },
    { name: 'general-catalyst', scraper: new GeneralCatalystScraper(), tier: 2, enabled: true },
    { name: 'bessemer', scraper: new BessemerScraper(), tier: 2, enabled: true },
    { name: 'nea', scraper: new NEAScraper(), tier: 2, enabled: true },
    { name: 'insight', scraper: new InsightScraper(), tier: 2, enabled: true },
    { name: 'khosla', scraper: new KhoslaScraper(), tier: 2, enabled: true },
    { name: 'thrive', scraper: new ThriveScraper(), tier: 2, enabled: true },
    { name: 'battery', scraper: new BatteryScraper(), tier: 2, enabled: true },

    // Tier 3 - ATS aggregation
    { name: 'greenhouse', scraper: new GreenhouseScraper(), tier: 3, enabled: true },
    { name: 'lever', scraper: new LeverScraper(), tier: 3, enabled: true },

    // Tier 4 - Aggregators
    { name: 'topstartups', scraper: new TopStartupsScraper(), tier: 4, enabled: true },
    { name: 'trueup', scraper: new TrueUpScraper(), tier: 4, enabled: true },

    // Tier 5 - Funding sources
    { name: 'techcrunch-rss', scraper: new TechCrunchRSSScraper(), tier: 5, enabled: true },
  ];
}

let registry: ScraperRegistry[] | null = null;

export function getRegistry(): ScraperRegistry[] {
  if (!registry) {
    registry = createRegistry();
  }
  return registry;
}

export async function runScraper(entry: ScraperRegistry): Promise<{
  jobs_found: number;
  jobs_new: number;
  jobs_updated: number;
  duration_ms: number;
}> {
  const start = Date.now();
  let jobsFound = 0;
  let jobsNew = 0;
  let jobsUpdated = 0;

  try {
    console.log(`[Registry] Starting scraper: ${entry.name}`);
    const result: ScraperResult = await entry.scraper.scrape();

    // Build company name->id map
    const companyMap = new Map<string, number>();
    for (const company of result.companies) {
      try {
        const id = upsertCompany(company);
        companyMap.set(company.name.toLowerCase(), id);
      } catch (err: any) {
        console.error(`[Registry] Failed to upsert company ${company.name}:`, err.message);
      }
    }

    // Upsert jobs
    for (const job of result.jobs) {
      try {
        let companyId = companyMap.get(job.company_name.toLowerCase());
        if (!companyId) {
          // Create minimal company record
          companyId = upsertCompany({ name: job.company_name });
          companyMap.set(job.company_name.toLowerCase(), companyId);
        }

        const { isNew } = upsertJob(job, companyId);
        jobsFound++;
        if (isNew) jobsNew++;
        else jobsUpdated++;
      } catch (err: any) {
        console.error(`[Registry] Failed to upsert job "${job.title}" at ${job.company_name}:`, err.message);
      }
    }

    // Handle funding events
    if (result.fundingEvents) {
      const { findFundingEvent, insertFundingEvent } = await import('../db/store.js');
      for (const event of result.fundingEvents) {
        try {
          let companyId = companyMap.get(event.company_name.toLowerCase());
          if (!companyId) {
            companyId = upsertCompany({ name: event.company_name, investors: event.investors });
            companyMap.set(event.company_name.toLowerCase(), companyId);
          }

          // Check if funding event already exists
          const existing = findFundingEvent(companyId, event.round_type, event.date);

          if (!existing) {
            insertFundingEvent({
              company_id: companyId,
              round_type: event.round_type,
              amount: event.amount,
              date: event.date,
              investors: JSON.stringify(event.investors || []),
              source_url: event.source_url,
            });
          }
        } catch (err: any) {
          console.error(`[Registry] Failed to upsert funding event for ${event.company_name}:`, err.message);
        }
      }
    }

    const duration = Date.now() - start;
    logScrape(entry.name, 'success', {
      jobs_found: jobsFound,
      jobs_new: jobsNew,
      jobs_updated: jobsUpdated,
      duration_ms: duration,
    });

    console.log(`[Registry] ${entry.name} done: ${jobsFound} found, ${jobsNew} new, ${jobsUpdated} updated (${duration}ms)`);
    return { jobs_found: jobsFound, jobs_new: jobsNew, jobs_updated: jobsUpdated, duration_ms: duration };

  } catch (err: any) {
    const duration = Date.now() - start;
    logScrape(entry.name, 'error', {
      error_message: err.message,
      duration_ms: duration,
    });
    console.error(`[Registry] ${entry.name} failed after ${duration}ms:`, err.message);
    return { jobs_found: 0, jobs_new: 0, jobs_updated: 0, duration_ms: duration };
  }
}

export async function runAllScrapers(options?: { tier?: number; names?: string[] }): Promise<{
  total_found: number;
  total_new: number;
  total_updated: number;
  total_duration_ms: number;
  results: Record<string, { jobs_found: number; jobs_new: number; status: string }>;
}> {
  const entries = getRegistry().filter(e => {
    if (!e.enabled) return false;
    if (options?.tier && e.tier !== options.tier) return false;
    if (options?.names && !options.names.includes(e.name)) return false;
    return true;
  });

  console.log(`[Registry] Running ${entries.length} scrapers...`);

  let totalFound = 0;
  let totalNew = 0;
  let totalUpdated = 0;
  const start = Date.now();
  const results: Record<string, { jobs_found: number; jobs_new: number; status: string }> = {};

  // Run scrapers sequentially to be respectful of rate limits
  for (const entry of entries) {
    try {
      const result = await runScraper(entry);
      totalFound += result.jobs_found;
      totalNew += result.jobs_new;
      totalUpdated += result.jobs_updated;
      results[entry.name] = { jobs_found: result.jobs_found, jobs_new: result.jobs_new, status: 'success' };
    } catch (err: any) {
      results[entry.name] = { jobs_found: 0, jobs_new: 0, status: 'error: ' + err.message };
    }

    // Brief pause between scrapers
    await new Promise(r => setTimeout(r, 1000));
  }

  const totalDuration = Date.now() - start;
  console.log(`[Registry] All scrapers done: ${totalFound} found, ${totalNew} new, ${totalUpdated} updated (${totalDuration}ms)`);

  return {
    total_found: totalFound,
    total_new: totalNew,
    total_updated: totalUpdated,
    total_duration_ms: totalDuration,
    results,
  };
}
