import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

export default class NeaScraper extends BaseScraper {
  name = 'nea';

  private readonly BASE_URL = 'https://careers.nea.com';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companiesMap = new Map<string, RawCompany>();

    try {
      await this.scrapeJobsPage(jobs, companiesMap);
    } catch (err) {
      this.logError('Failed to scrape NEA jobs', err);
    }

    this.log(`Scraped ${jobs.length} jobs from ${companiesMap.size} companies`);
    return { jobs, companies: Array.from(companiesMap.values()) };
  }

  private async scrapeJobsPage(jobs: RawJob[], companiesMap: Map<string, RawCompany>): Promise<void> {
    const $ = await this.fetchHtml(this.BASE_URL);

    // Try __NEXT_DATA__
    const nextData = $('script#__NEXT_DATA__').html();
    if (nextData) {
      try {
        const parsed = JSON.parse(nextData);
        const jobsList = this.findJobsArray(parsed);
        for (const j of jobsList) {
          this.addJob(j, jobs, companiesMap);
        }
        if (jobs.length > 0) return;
      } catch (e) {
        this.logError('Failed to parse __NEXT_DATA__', e);
      }
    }

    // Try inline JSON data
    $('script[type="application/json"], script:not([src])').each((_, el) => {
      const text = $(el).html() || '';
      if (text.includes('"jobs"') || text.includes('"openings"') || text.includes('"positions"')) {
        try {
          const data = JSON.parse(text);
          const list = data.jobs || data.openings || data.positions || [];
          if (Array.isArray(list)) {
            for (const j of list) this.addJob(j, jobs, companiesMap);
          }
        } catch { /* ignore */ }
      }
    });

    if (jobs.length > 0) return;

    // Try API endpoints
    for (const path of ['/api/jobs', '/api/v1/jobs', '/api/careers']) {
      try {
        const data = await this.fetchJson<any>(`${this.BASE_URL}${path}`);
        const list = Array.isArray(data) ? data : (data?.jobs || data?.data || data?.openings || []);
        for (const j of list) this.addJob(j, jobs, companiesMap);
        if (jobs.length > 0) return;
      } catch { /* try next */ }
    }

    // Fallback: HTML scraping
    const selectors = [
      '[data-testid="job-card"]', '.job-card', '[class*="JobCard"]',
      '[class*="job-listing"]', '[class*="career"]', '[class*="position"]',
      'a[href*="/jobs/"]', 'a[href*="/job/"]',
      'table tr', '.listing', 'article',
    ];

    for (const selector of selectors) {
      const cards = $(selector);
      if (cards.length > 2) {
        cards.each((_, el) => {
          try {
            const card = $(el);
            const title = cleanText(card.find('h2, h3, h4, [class*="title"], [class*="role"], td:first-child').first().text());
            const company = cleanText(card.find('[class*="company"], [class*="org"], td:nth-child(2)').first().text());
            const location = cleanText(card.find('[class*="location"], [class*="city"], td:nth-child(3)').first().text());
            const href = card.is('a') ? card.attr('href') : card.find('a').first().attr('href');
            const url = href ? (href.startsWith('http') ? href : `${this.BASE_URL}${href}`) : this.BASE_URL;

            if (title && company) {
              jobs.push({ title, company_name: company, location: location || undefined, remote_type: parseRemoteType(location), url, source: this.name });
              if (!companiesMap.has(company.toLowerCase())) {
                companiesMap.set(company.toLowerCase(), { name: company, investors: ['NEA'] });
              }
            }
          } catch { /* skip */ }
        });
        break;
      }
    }
  }

  private addJob(j: any, jobs: RawJob[], companiesMap: Map<string, RawCompany>): void {
    const title = j.title || j.name || j.role || '';
    const company = j.company?.name || j.companyName || j.company || j.organization_name || '';
    if (!title || !company) return;

    const companyStr = typeof company === 'string' ? company : '';
    const location = j.location || j.locationName || j.location_name || j.city || '';
    const rawUrl = j.url || j.job_url || j.apply_url || j.link || '';
    const url = rawUrl.startsWith('http') ? rawUrl : `${this.BASE_URL}${rawUrl}`;

    jobs.push({
      title, company_name: companyStr, location: location || undefined,
      remote_type: parseRemoteType(location), url, source: this.name,
      posted_at: j.published_at || j.publishedAt || j.date || undefined,
    });

    if (companyStr && !companiesMap.has(companyStr.toLowerCase())) {
      companiesMap.set(companyStr.toLowerCase(), {
        name: companyStr,
        website: j.company?.website || j.company_url || undefined,
        investors: ['NEA'],
      });
    }
  }

  private findJobsArray(obj: any): any[] {
    if (!obj || typeof obj !== 'object') return [];
    if (Array.isArray(obj) && obj.length > 0 && (obj[0]?.title || obj[0]?.role)) return obj;
    for (const key of ['jobs', 'initialJobs', 'jobPostings', 'allJobs', 'openings', 'positions', 'careers']) {
      if (obj[key] && Array.isArray(obj[key])) return obj[key];
    }
    for (const key of Object.keys(obj)) {
      const found = this.findJobsArray(obj[key]);
      if (found.length > 0) return found;
    }
    return [];
  }
}
