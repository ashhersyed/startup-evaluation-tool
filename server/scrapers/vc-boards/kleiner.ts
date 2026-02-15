import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

export default class KleinerScraper extends BaseScraper {
  name = 'kleiner';

  private readonly BASE_URL = 'https://jobs.kleinerperkins.com';
  private readonly COMPANIES_URL = 'https://jobs.kleinerperkins.com/companies';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companiesMap = new Map<string, RawCompany>();

    try {
      await this.scrapeGetroBoard(jobs, companiesMap);
    } catch (err) {
      this.logError('Failed to scrape Kleiner Perkins jobs', err);
    }

    this.log(`Scraped ${jobs.length} jobs from ${companiesMap.size} companies`);
    return { jobs, companies: Array.from(companiesMap.values()) };
  }

  private async scrapeGetroBoard(jobs: RawJob[], companiesMap: Map<string, RawCompany>): Promise<void> {
    // KP uses a companies page that links to jobs - try the jobs endpoint first
    const jobsUrl = `${this.BASE_URL}/jobs`;
    let $: cheerio.CheerioAPI;

    try {
      $ = await this.fetchHtml(jobsUrl);
    } catch {
      $ = await this.fetchHtml(this.COMPANIES_URL);
    }

    // Try __NEXT_DATA__
    const nextData = $('script#__NEXT_DATA__').html();
    if (nextData) {
      try {
        const parsed = JSON.parse(nextData);
        const jobsList = this.findJobsArray(parsed);
        for (const j of jobsList) {
          this.addJob(j, jobs, companiesMap);
        }

        // Also look for companies data
        const companies = this.findCompaniesArray(parsed);
        for (const c of companies) {
          const name = c.name || '';
          if (name && !companiesMap.has(name.toLowerCase())) {
            companiesMap.set(name.toLowerCase(), {
              name,
              website: c.website || c.url || undefined,
              description: c.description || undefined,
              logo_url: c.logo || c.logoUrl || undefined,
              investors: ['Kleiner Perkins'],
            });
          }
        }

        if (jobs.length > 0) return;
      } catch (e) {
        this.logError('Failed to parse __NEXT_DATA__', e);
      }
    }

    // Try Getro API
    for (const path of ['/api/jobs', '/api/v1/jobs']) {
      try {
        const data = await this.fetchJson<any>(`${this.BASE_URL}${path}`);
        const list = Array.isArray(data) ? data : (data?.jobs || data?.data || []);
        for (const j of list) this.addJob(j, jobs, companiesMap);
        if (jobs.length > 0) return;
      } catch { /* try next */ }
    }

    // Fallback: HTML scraping
    const selectors = ['[data-testid="job-card"]', '.job-card', '[class*="JobCard"]', '[class*="job-listing"]', 'a[href*="/jobs/"]'];
    for (const selector of selectors) {
      const cards = $(selector);
      if (cards.length > 0) {
        cards.each((_, el) => {
          try {
            const card = $(el);
            const title = cleanText(card.find('h3, h4, [class*="title"]').first().text());
            const company = cleanText(card.find('[class*="company"]').first().text());
            const location = cleanText(card.find('[class*="location"]').first().text());
            const href = card.is('a') ? card.attr('href') : card.find('a').first().attr('href');
            const url = href ? (href.startsWith('http') ? href : `${this.BASE_URL}${href}`) : this.BASE_URL;

            if (title && company) {
              jobs.push({ title, company_name: company, location: location || undefined, remote_type: parseRemoteType(location), url, source: this.name });
              if (!companiesMap.has(company.toLowerCase())) {
                companiesMap.set(company.toLowerCase(), { name: company, investors: ['Kleiner Perkins'] });
              }
            }
          } catch { /* skip */ }
        });
        break;
      }
    }
  }

  private addJob(j: any, jobs: RawJob[], companiesMap: Map<string, RawCompany>): void {
    const title = j.title || j.name || '';
    const company = j.company?.name || j.companyName || j.organization_name || '';
    if (!title || !company) return;

    const location = j.location || j.locationName || j.location_name || '';
    const rawUrl = j.url || j.job_url || j.apply_url || '';
    const url = rawUrl.startsWith('http') ? rawUrl : `${this.BASE_URL}${rawUrl}`;

    jobs.push({
      title, company_name: company, location: location || undefined,
      remote_type: parseRemoteType(location), url, source: this.name,
      posted_at: j.published_at || j.publishedAt || undefined,
    });

    if (!companiesMap.has(company.toLowerCase())) {
      companiesMap.set(company.toLowerCase(), {
        name: company,
        website: j.company?.website || j.company_url || undefined,
        logo_url: j.company?.logo || undefined,
        investors: ['Kleiner Perkins'],
      });
    }
  }

  private findJobsArray(obj: any): any[] {
    if (!obj || typeof obj !== 'object') return [];
    if (Array.isArray(obj) && obj.length > 0 && obj[0]?.title) return obj;
    for (const key of ['jobs', 'initialJobs', 'jobPostings', 'allJobs']) {
      if (obj[key] && Array.isArray(obj[key])) return obj[key];
    }
    for (const key of Object.keys(obj)) {
      const found = this.findJobsArray(obj[key]);
      if (found.length > 0) return found;
    }
    return [];
  }

  private findCompaniesArray(obj: any): any[] {
    if (!obj || typeof obj !== 'object') return [];
    for (const key of ['companies', 'portfolioCompanies', 'organizations']) {
      if (obj[key] && Array.isArray(obj[key])) return obj[key];
    }
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') {
        const found = this.findCompaniesArray(obj[key]);
        if (found.length > 0) return found;
      }
    }
    return [];
  }
}
