import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, parseSalary, cleanText } from '../base.js';

export default class TrueUpScraper extends BaseScraper {
  name = 'trueup';

  private maxPages = 5;

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const seenCompanies = new Set<string>();

    // Try the JSON API first, then fall back to HTML scraping
    const gotJsonData = await this.tryJsonApi(jobs, companies, seenCompanies);

    if (!gotJsonData) {
      await this.scrapeHtml(jobs, companies, seenCompanies);
    }

    this.log(`Scrape complete: ${jobs.length} jobs from ${seenCompanies.size} companies`);
    return { jobs, companies };
  }

  private async tryJsonApi(
    jobs: RawJob[],
    companies: RawCompany[],
    seenCompanies: Set<string>,
  ): Promise<boolean> {
    try {
      // TrueUp sometimes has a JSON endpoint
      const apiUrls = [
        'https://www.trueup.io/api/jobs?limit=100',
        'https://www.trueup.io/api/v1/jobs?limit=100',
      ];

      for (const apiUrl of apiUrls) {
        try {
          const data = await this.fetchJson<any>(apiUrl);
          const items = Array.isArray(data) ? data : data?.jobs || data?.results || data?.data;

          if (Array.isArray(items) && items.length > 0) {
            this.log(`JSON API returned ${items.length} jobs from ${apiUrl}`);
            for (const item of items) {
              this.parseJsonJob(item, jobs, companies, seenCompanies);
            }
            return true;
          }
        } catch {
          // Try next URL
        }
      }
    } catch (err) {
      this.logError('JSON API not available, falling back to HTML', err);
    }
    return false;
  }

  private parseJsonJob(
    item: any,
    jobs: RawJob[],
    companies: RawCompany[],
    seenCompanies: Set<string>,
  ): void {
    const companyName = item.company_name || item.company || item.companyName || '';
    const title = item.title || item.job_title || item.name || '';

    if (!companyName || !title) return;

    const location = item.location || item.city || '';
    const salaryText = item.salary || item.compensation || '';
    const salary = parseSalary(salaryText);

    jobs.push({
      title,
      company_name: companyName,
      description: cleanText(item.description || '').substring(0, 3000),
      location: location || undefined,
      remote_type: parseRemoteType(location + ' ' + (item.remote || '')),
      salary_min: salary.min || item.salary_min,
      salary_max: salary.max || item.salary_max,
      salary_currency: salary.currency,
      url: item.url || item.apply_url || `https://www.trueup.io/job/${item.id || item.slug || ''}`,
      source: this.name,
      source_id: `trueup-${item.id || item.slug || title.replace(/\s+/g, '-').toLowerCase()}`,
      posted_at: item.posted_at || item.created_at || item.date,
    });

    const companyKey = companyName.toLowerCase();
    if (!seenCompanies.has(companyKey)) {
      seenCompanies.add(companyKey);
      companies.push({
        name: companyName,
        website: item.company_url || item.company_website,
        logo_url: item.company_logo || item.logo_url,
        industry: item.industry || item.category,
      });
    }
  }

  private async scrapeHtml(
    jobs: RawJob[],
    companies: RawCompany[],
    seenCompanies: Set<string>,
  ): Promise<void> {
    for (let page = 1; page <= this.maxPages; page++) {
      try {
        const url = page === 1
          ? 'https://www.trueup.io/jobs'
          : `https://www.trueup.io/jobs?page=${page}`;

        this.log(`Fetching HTML page ${page}...`);
        const $ = await this.fetchHtml(url);

        const jobCards = this.findJobElements($);
        if (jobCards.length === 0) {
          this.log(`No job cards found on page ${page}, stopping`);
          break;
        }

        for (const card of jobCards) {
          const $card = $(card);

          const title = cleanText(
            $card.find('h2, h3, .job-title, [data-testid="job-title"], a[href*="/job/"]').first().text()
          );
          const companyName = cleanText(
            $card.find('.company-name, .company, [data-testid="company-name"], h4').first().text()
          );
          const location = cleanText(
            $card.find('.location, [data-testid="location"], .job-location').first().text()
          );
          const salaryText = cleanText(
            $card.find('.salary, .compensation, [data-testid="salary"]').first().text()
          );
          const jobUrl = $card.find('a[href*="/job/"]').first().attr('href')
            || $card.find('a').first().attr('href')
            || '';

          if (!title || !companyName) continue;

          const salary = parseSalary(salaryText);
          const fullUrl = jobUrl.startsWith('http')
            ? jobUrl
            : `https://www.trueup.io${jobUrl}`;

          jobs.push({
            title,
            company_name: companyName,
            location: location || undefined,
            remote_type: parseRemoteType(location + ' ' + title),
            salary_min: salary.min,
            salary_max: salary.max,
            salary_currency: salary.currency,
            url: fullUrl,
            source: this.name,
            source_id: `trueup-${jobUrl.replace(/[^a-zA-Z0-9]/g, '-')}`,
          });

          const companyKey = companyName.toLowerCase();
          if (!seenCompanies.has(companyKey)) {
            seenCompanies.add(companyKey);
            const companyLogo = $card.find('img').first().attr('src') || undefined;
            companies.push({
              name: companyName,
              logo_url: companyLogo,
            });
          }
        }

        this.log(`Parsed ${jobCards.length} jobs from page ${page}`);

        // Check if there's a next page
        const hasNext = $('a[href*="page="], .pagination .next, [aria-label="Next"]').length > 0;
        if (!hasNext) break;

        await this.delay(800);
      } catch (err) {
        this.logError(`Failed to scrape page ${page}`, err);
        break;
      }
    }
  }

  private findJobElements($: Awaited<ReturnType<typeof this.fetchHtml>>): any[] {
    const selectors = [
      '.job-card',
      '.job-listing',
      '[data-testid="job-card"]',
      'tr[data-job]',
      '.jobs-list > div',
      '.job-row',
      'article',
    ];

    for (const sel of selectors) {
      const items = $(sel).toArray();
      if (items.length > 0) return items;
    }

    return [];
  }
}
