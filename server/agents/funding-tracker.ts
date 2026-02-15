import { getDb } from '../db/schema.js';
import { upsertCompany } from '../scrapers/base.js';
import { CareerPageFinder } from '../scrapers/funding/career-page-finder.js';
import TechCrunchRSSScraper from '../scrapers/funding/techcrunch-rss.js';

export async function runFundingTracker(): Promise<{
  new_companies: number;
  updated_companies: number;
  career_pages_found: number;
  funding_events: number;
}> {
  const db = getDb();
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
          const jobCount = db.prepare(
            'SELECT COUNT(*) as cnt FROM jobs WHERE company_id = ?'
          ).get(companyId) as { cnt: number };

          if (jobCount.cnt === 0) {
            newCompanies++;
          } else {
            updatedCompanies++;
          }

          // Insert funding event if not exists
          const existing = db.prepare(
            'SELECT id FROM funding_events WHERE company_id = ? AND round_type = ? AND (date = ? OR date IS NULL)'
          ).get(companyId, event.round_type, event.date);

          if (!existing) {
            db.prepare(`
              INSERT INTO funding_events (company_id, round_type, amount, date, investors, source_url)
              VALUES (?, ?, ?, ?, ?, ?)
            `).run(
              companyId, event.round_type, event.amount, event.date,
              JSON.stringify(event.investors || []), event.source_url
            );
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
  const recentCompanies = db.prepare(`
    SELECT DISTINCT c.id, c.name, c.website
    FROM companies c
    JOIN funding_events fe ON fe.company_id = c.id
    LEFT JOIN jobs j ON j.company_id = c.id AND j.is_active = 1
    WHERE fe.scraped_at > datetime('now', '-7 days')
    AND j.id IS NULL
    AND c.website IS NOT NULL
    LIMIT 20
  `).all() as { id: number; name: string; website: string | null }[];

  console.log(`[FundingTracker] Checking career pages for ${recentCompanies.length} recently funded companies...`);

  const finder = new CareerPageFinder();
  for (const company of recentCompanies) {
    try {
      const pages = await finder.findCareerPages(company.name, company.website || undefined);
      if (pages.length > 0) {
        careerPagesFound++;
        console.log(`[FundingTracker] Found career page for ${company.name}: ${pages[0]}`);
        // Store the career page URL in company website if not set
        if (!company.website && pages[0]) {
          db.prepare('UPDATE companies SET website = ? WHERE id = ?').run(pages[0], company.id);
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
