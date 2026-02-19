import {
  getStore,
  findFundingEvent,
  insertFundingEvent,
  updateCompany,
  getJobsByCompany,
} from '../db/store.js';
import { upsertCompany } from '../scrapers/base.js';
import { CareerPageFinder } from '../scrapers/funding/career-page-finder.js';
import TechCrunchRSSScraper from '../scrapers/funding/techcrunch-rss.js';

export async function runFundingTracker(): Promise<{
  new_companies: number;
  updated_companies: number;
  career_pages_found: number;
  funding_events: number;
}> {
  const store = getStore();
  console.log('[FundingTracker] Starting funding tracker...');

  let newCompanies = 0;
  let updatedCompanies = 0;
  let careerPagesFound = 0;
  let fundingEventsCount = 0;

  // Step 1: Scrape TechCrunch RSS for recent funding announcements
  const tcScraper = new TechCrunchRSSScraper();
  try {
    const result = await tcScraper.scrape();

    // Process funding events
    if (result.fundingEvents) {
      for (const event of result.fundingEvents) {
        try {
          // Upsert the company
          const companyId = upsertCompany({
            name: event.company_name,
            funding_stage: event.round_type,
            investors: event.investors,
          });

          // Check if it's a new company (no jobs yet)
          const companyJobs = getJobsByCompany(companyId);
          if (companyJobs.length === 0) {
            newCompanies++;
          } else {
            updatedCompanies++;
          }

          // Insert funding event if not exists
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
            fundingEventsCount++;
          }
        } catch (err: any) {
          console.error(`[FundingTracker] Error processing ${event.company_name}:`, err.message);
        }
      }
    }

    // Process companies from RSS
    for (const company of result.companies) {
      try {
        upsertCompany(company);
      } catch (err: any) {
        console.error(`[FundingTracker] Error upserting company ${company.name}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[FundingTracker] TechCrunch RSS scrape failed:', err.message);
  }

  // Step 2: Find career pages for recently funded companies without any jobs
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const fundingEvents = Object.values(store.funding_events).filter(
    fe => fe.scraped_at > sevenDaysAgo
  );

  // Get unique company IDs from recent funding events
  const recentCompanyIds = [...new Set(fundingEvents.map(fe => fe.company_id))];

  // Filter to companies with no active jobs and a website
  const recentCompanies: { id: number; name: string; website: string | null }[] = [];
  for (const cid of recentCompanyIds) {
    const company = store.companies[cid];
    if (!company) continue;
    const jobs = getJobsByCompany(cid);
    if (jobs.length === 0 && company.website) {
      recentCompanies.push({ id: company.id, name: company.name, website: company.website });
    }
    if (recentCompanies.length >= 20) break;
  }

  console.log(`[FundingTracker] Checking career pages for ${recentCompanies.length} recently funded companies...`);

  const finder = new CareerPageFinder();
  for (const company of recentCompanies) {
    try {
      const pages = await finder.findCareerPages(company.name, company.website || undefined);
      if (pages.length > 0) {
        careerPagesFound++;
        console.log(`[FundingTracker] Found career page for ${company.name}: ${pages[0]}`);
        if (!company.website && pages[0]) {
          updateCompany(company.id, { website: pages[0] });
        }
      }
    } catch (err: any) {
      console.error(`[FundingTracker] Career page search failed for ${company.name}:`, err.message);
    }

    // Brief delay between company lookups
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[FundingTracker] Done: ${newCompanies} new companies, ${updatedCompanies} updated, ${careerPagesFound} career pages found, ${fundingEventsCount} funding events`);

  return {
    new_companies: newCompanies,
    updated_companies: updatedCompanies,
    career_pages_found: careerPagesFound,
    funding_events: fundingEventsCount,
  };
}
