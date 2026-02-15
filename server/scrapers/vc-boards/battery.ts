import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  updated_at?: string;
  metadata?: Array<{ name: string; value: string | null }>;
}

interface GreenhouseDepartment {
  id: number;
  name: string;
  jobs: GreenhouseJob[];
}

interface GreenhouseBoard {
  name: string;
  departments: GreenhouseDepartment[];
}

export default class BatteryScraper extends BaseScraper {
  name = 'battery';

  // Battery Ventures uses Greenhouse for their portfolio job board
  private readonly GREENHOUSE_BOARD = 'batteryventures';
  private readonly API_URL = `https://boards-api.greenhouse.io/v1/boards/${this.GREENHOUSE_BOARD}`;

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companiesMap = new Map<string, RawCompany>();

    try {
      await this.scrapeGreenhouseBoard(jobs, companiesMap);
    } catch (err) {
      this.logError('Failed to scrape Battery Ventures Greenhouse board', err);

      // Fallback: try scraping the HTML board page
      try {
        await this.scrapeGreenhouseHtml(jobs, companiesMap);
      } catch (fallbackErr) {
        this.logError('Greenhouse HTML fallback also failed', fallbackErr);
      }
    }

    this.log(`Scraped ${jobs.length} jobs from ${companiesMap.size} companies`);
    return { jobs, companies: Array.from(companiesMap.values()) };
  }

  private async scrapeGreenhouseBoard(jobs: RawJob[], companiesMap: Map<string, RawCompany>): Promise<void> {
    // Greenhouse public API for job boards
    const data = await this.fetchJson<GreenhouseBoard>(`${this.API_URL}/departments`);

    for (const dept of data.departments || []) {
      for (const job of dept.jobs || []) {
        try {
          const title = job.title || '';
          const locationStr = job.location?.name || '';

          // Greenhouse board jobs are all under Battery Ventures, but the job titles
          // often contain the portfolio company name in format "Company - Role"
          // or the metadata may contain company info
          let company = 'Battery Ventures Portfolio';
          const companyMatch = title.match(/^(.+?)\s*[-–—:]\s+/);
          if (companyMatch) {
            company = companyMatch[1].trim();
          }

          // Check metadata for company name
          if (job.metadata) {
            const companyMeta = job.metadata.find(m =>
              m.name.toLowerCase().includes('company') || m.name.toLowerCase().includes('organization')
            );
            if (companyMeta?.value) {
              company = companyMeta.value;
            }
          }

          const cleanTitle = companyMatch ? title.replace(companyMatch[0], '').trim() : title;

          jobs.push({
            title: cleanTitle || title,
            company_name: company,
            location: locationStr || undefined,
            remote_type: parseRemoteType(locationStr),
            url: job.absolute_url,
            source: this.name,
            source_id: String(job.id),
            posted_at: job.updated_at || undefined,
          });

          if (!companiesMap.has(company.toLowerCase())) {
            companiesMap.set(company.toLowerCase(), {
              name: company,
              investors: ['Battery Ventures'],
            });
          }
        } catch (e) {
          this.logError(`Failed to parse job ${job.id}`, e);
        }
      }
    }
  }

  private async scrapeGreenhouseHtml(jobs: RawJob[], companiesMap: Map<string, RawCompany>): Promise<void> {
    const boardUrl = `https://boards.greenhouse.io/${this.GREENHOUSE_BOARD}`;
    const $ = await this.fetchHtml(boardUrl);

    // Greenhouse HTML boards have a standard structure
    $('section.level-0 .opening').each((_, el) => {
      try {
        const opening = $(el);
        const linkEl = opening.find('a');
        const title = cleanText(linkEl.text());
        const href = linkEl.attr('href') || '';
        const location = cleanText(opening.find('.location').text());

        if (!title) return;

        let company = 'Battery Ventures Portfolio';
        const companyMatch = title.match(/^(.+?)\s*[-–—:]\s+/);
        if (companyMatch) {
          company = companyMatch[1].trim();
        }
        const cleanTitle = companyMatch ? title.replace(companyMatch[0], '').trim() : title;
        const url = href.startsWith('http') ? href : `https://boards.greenhouse.io${href}`;

        jobs.push({
          title: cleanTitle || title,
          company_name: company,
          location: location || undefined,
          remote_type: parseRemoteType(location),
          url,
          source: this.name,
        });

        if (!companiesMap.has(company.toLowerCase())) {
          companiesMap.set(company.toLowerCase(), {
            name: company,
            investors: ['Battery Ventures'],
          });
        }
      } catch { /* skip */ }
    });

    // Alternative: some Greenhouse boards use different selectors
    if (jobs.length === 0) {
      $('.job-post, [class*="job-listing"], tr.job-post').each((_, el) => {
        try {
          const row = $(el);
          const title = cleanText(row.find('a, .job-title, td:first-child').first().text());
          const location = cleanText(row.find('.location, td:last-child').first().text());
          const href = row.find('a').first().attr('href') || '';
          const url = href.startsWith('http') ? href : `https://boards.greenhouse.io${href}`;

          if (title) {
            let company = 'Battery Ventures Portfolio';
            const companyMatch = title.match(/^(.+?)\s*[-–—:]\s+/);
            if (companyMatch) company = companyMatch[1].trim();

            jobs.push({
              title: companyMatch ? title.replace(companyMatch[0], '').trim() : title,
              company_name: company,
              location: location || undefined,
              remote_type: parseRemoteType(location),
              url,
              source: this.name,
            });

            if (!companiesMap.has(company.toLowerCase())) {
              companiesMap.set(company.toLowerCase(), { name: company, investors: ['Battery Ventures'] });
            }
          }
        } catch { /* skip */ }
      });
    }
  }
}
