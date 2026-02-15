import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

export default class SequoiaScraper extends BaseScraper {
  name = 'sequoia';

  private readonly BASE_URL = 'https://jobs.sequoiacap.com';
  private readonly JOBS_URL = 'https://jobs.sequoiacap.com/jobs/';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companiesMap = new Map<string, RawCompany>();

    try {
      await this.scrapeGetroBoard(jobs, companiesMap);
    } catch (err) {
      this.logError('Failed to scrape Sequoia jobs', err);
    }

    this.log(`Scraped ${jobs.length} jobs from ${companiesMap.size} companies`);
    return { jobs, companies: Array.from(companiesMap.values()) };
  }

  private async scrapeGetroBoard(jobs: RawJob[], companiesMap: Map<string, RawCompany>): Promise<void> {
    const $ = await this.fetchHtml(this.JOBS_URL);

    // Try __NEXT_DATA__ first
    const nextData = $('script#__NEXT_DATA__').html();
    if (nextData) {
      try {
        const parsed = JSON.parse(nextData);
        const pageProps = parsed?.props?.pageProps;
        const jobsList = pageProps?.jobs || pageProps?.initialJobs || [];
        for (const j of jobsList) {
          this.addJobFromGetro(j, jobs, companiesMap);
        }
        if (jobs.length > 0) return;
      } catch (e) {
        this.logError('Failed to parse __NEXT_DATA__', e);
      }
    }

    // Try Getro API endpoint
    try {
      const apiJobs = await this.fetchGetroApi();
      for (const j of apiJobs) {
        this.addJobFromGetro(j, jobs, companiesMap);
      }
      if (jobs.length > 0) return;
    } catch (e) {
      this.logError('Getro API failed, falling back to HTML', e);
    }

    // Fallback: HTML scraping
    this.scrapeJobCards($, jobs, companiesMap);
  }

  private async fetchGetroApi(): Promise<any[]> {
    // Common Getro API patterns
    const endpoints = [
      `${this.BASE_URL}/api/jobs`,
      `${this.BASE_URL}/api/v1/jobs`,
    ];

    for (const endpoint of endpoints) {
      try {
        const data = await this.fetchJson<any>(endpoint);
        if (Array.isArray(data)) return data;
        if (data?.jobs) return data.jobs;
        if (data?.data) return Array.isArray(data.data) ? data.data : [];
      } catch { /* try next */ }
    }
    return [];
  }

  private scrapeJobCards($: cheerio.CheerioAPI, jobs: RawJob[], companiesMap: Map<string, RawCompany>): void {
    const selectors = [
      '[data-testid="job-card"]',
      '.job-card',
      '[class*="JobCard"]',
      '[class*="job-listing"]',
      'a[href*="/jobs/"]',
      '.jobs-list li',
      '.job-item',
    ];

    for (const selector of selectors) {
      const cards = $(selector);
      if (cards.length > 0) {
        cards.each((_, el) => {
          try {
            const card = $(el);
            const title = cleanText(card.find('h3, h4, [class*="title"], [data-testid="job-title"]').first().text());
            const company = cleanText(card.find('[class*="company"], [data-testid="company-name"]').first().text());
            const location = cleanText(card.find('[class*="location"], [data-testid="location"]').first().text());
            const href = card.is('a') ? card.attr('href') : card.find('a').first().attr('href');
            const url = href ? (href.startsWith('http') ? href : `${this.BASE_URL}${href}`) : this.JOBS_URL;

            if (title && company) {
              jobs.push({
                title,
                company_name: company,
                location: location || undefined,
                remote_type: parseRemoteType(location || ''),
                url,
                source: this.name,
              });

              if (!companiesMap.has(company.toLowerCase())) {
                companiesMap.set(company.toLowerCase(), {
                  name: company,
                  investors: ['Sequoia Capital'],
                });
              }
            }
          } catch { /* skip */ }
        });
        break;
      }
    }
  }

  private addJobFromGetro(j: any, jobs: RawJob[], companiesMap: Map<string, RawCompany>): void {
    const title = j.title || j.name || '';
    const company = j.company?.name || j.companyName || j.organization_name || '';
    if (!title || !company) return;

    const location = j.location || j.locationName || j.location_name || '';
    const jobUrl = j.url || j.job_url || j.apply_url || '';
    const url = jobUrl.startsWith('http') ? jobUrl : `${this.BASE_URL}${jobUrl}`;

    jobs.push({
      title,
      company_name: company,
      location: location || undefined,
      remote_type: parseRemoteType(location),
      url,
      source: this.name,
      posted_at: j.published_at || j.publishedAt || j.created_at || undefined,
    });

    if (!companiesMap.has(company.toLowerCase())) {
      companiesMap.set(company.toLowerCase(), {
        name: company,
        website: j.company?.website || j.company_url || undefined,
        logo_url: j.company?.logo || j.company_logo || undefined,
        investors: ['Sequoia Capital'],
      });
    }
  }
}
