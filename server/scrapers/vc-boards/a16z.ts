import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

export default class A16zScraper extends BaseScraper {
  name = 'a16z';

  private readonly PORTFOLIO_URL = 'https://portfoliojobs.a16z.com/';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companiesMap = new Map<string, RawCompany>();

    try {
      // Try scraping the portfolio jobs page (Getro-based)
      await this.scrapePortfolioPage(jobs, companiesMap);
    } catch (err) {
      this.logError('Failed to scrape portfolio page', err);
    }

    if (jobs.length === 0) {
      try {
        // Fallback: try HTML scraping
        await this.scrapeHtmlFallback(jobs, companiesMap);
      } catch (err) {
        this.logError('Fallback HTML scrape also failed', err);
      }
    }

    this.log(`Scraped ${jobs.length} jobs from ${companiesMap.size} companies`);
    return { jobs, companies: Array.from(companiesMap.values()) };
  }

  private async scrapePortfolioPage(jobs: RawJob[], companiesMap: Map<string, RawCompany>): Promise<void> {
    const $ = await this.fetchHtml(this.PORTFOLIO_URL);

    // Look for embedded JSON data in __NEXT_DATA__ or similar
    const nextDataScript = $('script#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        const jobsData = this.extractJobsFromNextData(nextData);
        for (const item of jobsData) {
          this.addJob(item, jobs, companiesMap);
        }
        return;
      } catch (e) {
        this.logError('Failed to parse __NEXT_DATA__', e);
      }
    }

    // Try extracting from inline script JSON blobs
    $('script').each((_, el) => {
      const scriptText = $(el).html() || '';
      if (scriptText.includes('"jobs"') || scriptText.includes('"jobPostings"')) {
        try {
          const jsonMatch = scriptText.match(/(\{[\s\S]*"jobs"[\s\S]*\})/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[1]);
            const jobsList = data.jobs || data.jobPostings || [];
            for (const j of jobsList) {
              this.addJob({
                title: j.title || j.name,
                company: j.company?.name || j.companyName || j.organization,
                location: j.location || j.locationName,
                url: j.url || j.applyUrl || j.jobUrl,
              }, jobs, companiesMap);
            }
          }
        } catch { /* ignore parse errors */ }
      }
    });

    // Fallback to DOM scraping
    if (jobs.length === 0) {
      // Common Getro job card selectors
      const selectors = [
        '[data-testid="job-card"]',
        '.job-card',
        '.JobCard',
        '[class*="JobCard"]',
        '[class*="job-listing"]',
        'a[href*="/jobs/"]',
      ];

      for (const selector of selectors) {
        const cards = $(selector);
        if (cards.length > 0) {
          cards.each((_, el) => {
            try {
              const card = $(el);
              const title = cleanText(card.find('[class*="title"], h3, h4, [data-testid="job-title"]').first().text());
              const company = cleanText(card.find('[class*="company"], [data-testid="company-name"], .company-name').first().text());
              const location = cleanText(card.find('[class*="location"], [data-testid="location"]').first().text());
              const link = card.attr('href') || card.find('a').first().attr('href') || '';

              if (title && company) {
                this.addJob({ title, company, location, url: link }, jobs, companiesMap);
              }
            } catch { /* skip bad card */ }
          });
          break;
        }
      }
    }
  }

  private async scrapeHtmlFallback(jobs: RawJob[], companiesMap: Map<string, RawCompany>): Promise<void> {
    const $ = await this.fetchHtml(this.PORTFOLIO_URL);

    $('div, li, article, tr').each((_, el) => {
      const card = $(el);
      const links = card.find('a[href*="job"], a[href*="career"], a[href*="lever.co"], a[href*="greenhouse"], a[href*="ashby"]');
      if (links.length > 0) {
        const title = cleanText(card.find('h2, h3, h4, [class*="title"]').first().text());
        const company = cleanText(card.find('[class*="company"], [class*="org"]').first().text());
        const location = cleanText(card.find('[class*="location"]').first().text());
        const url = links.first().attr('href') || '';

        if (title && (company || url)) {
          this.addJob({ title, company: company || 'Unknown', location, url }, jobs, companiesMap);
        }
      }
    });
  }

  private extractJobsFromNextData(data: any): Array<{ title: string; company: string; location: string; url: string }> {
    const results: Array<{ title: string; company: string; location: string; url: string }> = [];

    const traverse = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (const item of obj) traverse(item);
        return;
      }
      if (obj.title && (obj.company || obj.companyName || obj.organization)) {
        results.push({
          title: obj.title,
          company: obj.company?.name || obj.companyName || obj.organization || '',
          location: obj.location || obj.locationName || '',
          url: obj.url || obj.jobUrl || obj.applyUrl || '',
        });
      }
      for (const key of Object.keys(obj)) {
        traverse(obj[key]);
      }
    };

    traverse(data);
    return results;
  }

  private addJob(
    item: { title: string; company: string; location: string; url: string },
    jobs: RawJob[],
    companiesMap: Map<string, RawCompany>
  ): void {
    if (!item.title || !item.company) return;

    const url = item.url.startsWith('http') ? item.url : `${this.PORTFOLIO_URL}${item.url.replace(/^\//, '')}`;

    jobs.push({
      title: item.title,
      company_name: item.company,
      location: item.location || undefined,
      remote_type: parseRemoteType(item.location || ''),
      url,
      source: this.name,
    });

    if (!companiesMap.has(item.company.toLowerCase())) {
      companiesMap.set(item.company.toLowerCase(), {
        name: item.company,
        investors: ['Andreessen Horowitz'],
      });
    }
  }
}
