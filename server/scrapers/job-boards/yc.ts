import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, parseSalary, parseFundingStage, parseCompanySize, cleanText } from '../base.js';
import type { CheerioAPI } from 'cheerio';

export default class YCScraper extends BaseScraper {
  name = 'yc-work-at-startup';

  private readonly BASE_URL = 'https://www.workatastartup.com';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const companySet = new Set<string>();

    try {
      this.log('Fetching Work at a Startup page...');

      // Try the API endpoint first (WATS has an internal JSON API)
      const apiJobs = await this.tryApiScrape();
      if (apiJobs && apiJobs.jobs.length > 0) {
        this.log(`API scrape found ${apiJobs.jobs.length} jobs`);
        return apiJobs;
      }

      // Fall back to HTML scraping
      this.log('API scrape returned no results, falling back to HTML scraping...');
      const $ = await this.fetchHtml(`${this.BASE_URL}/companies`);

      // Try primary selectors (based on common WATS structure)
      let parsed = this.parseWithSelectors($, companySet);

      // If primary selectors fail, try fallback generic extraction
      if (parsed.jobs.length === 0) {
        this.log('Primary selectors failed, trying fallback extraction...');
        parsed = this.parseFallback($, companySet);
      }

      jobs.push(...parsed.jobs);
      companies.push(...parsed.companies);

      this.log(`Parsed ${jobs.length} jobs from ${companies.length} companies`);
    } catch (err) {
      this.logError('Failed to scrape Work at a Startup', err);
    }

    return { jobs, companies };
  }

  private async tryApiScrape(): Promise<ScraperResult | null> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const companySet = new Set<string>();

    try {
      // WATS uses an internal API for listing companies/jobs
      const data = await this.fetchJson<any>(
        `${this.BASE_URL}/companies/fetch?page=1&batch=&industry=&hasJobs=true&query=&tab=any`
      );

      const companyList = data?.companies || data?.results || [];
      if (!Array.isArray(companyList) || companyList.length === 0) return null;

      for (const co of companyList) {
        try {
          const companyName = co.name || co.company_name;
          if (!companyName) continue;

          const key = companyName.toLowerCase();
          if (!companySet.has(key)) {
            companySet.add(key);
            companies.push({
              name: companyName,
              website: co.website || co.url || undefined,
              description: co.one_liner || co.description || undefined,
              funding_stage: parseFundingStage(co.stage || co.funding_stage || ''),
              headcount_min: co.team_size ? Math.max(1, co.team_size - 5) : undefined,
              headcount_max: co.team_size ? co.team_size + 10 : undefined,
              location: co.location || co.city || undefined,
              logo_url: co.small_logo_url || co.logo_url || undefined,
              industry: co.industry || co.vertical || undefined,
              founded_year: co.year_founded || co.founded_year || undefined,
            });
          }

          const jobList = co.jobs || co.job_listings || [];
          for (const job of jobList) {
            const title = job.title || job.role;
            if (!title) continue;

            const salary = parseSalary(job.salary || '');
            jobs.push({
              title,
              company_name: companyName,
              description: cleanText(job.description || '').substring(0, 3000),
              location: job.location || co.location || undefined,
              remote_type: parseRemoteType(job.remote || job.location || ''),
              salary_min: job.salary_min || salary.min,
              salary_max: job.salary_max || salary.max,
              salary_currency: salary.currency || 'USD',
              url: job.url || `${this.BASE_URL}/companies/${co.slug || co.id}/jobs/${job.id || ''}`,
              source: this.name,
              source_id: job.id ? String(job.id) : undefined,
              posted_at: job.created_at || job.posted_at || undefined,
            });
          }
        } catch (err) {
          this.logError(`Failed to parse company entry`, err);
        }
      }
    } catch {
      return null;
    }

    return { jobs, companies };
  }

  private parseWithSelectors(
    $: CheerioAPI,
    companySet: Set<string>
  ): { jobs: RawJob[]; companies: RawCompany[] } {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];

    // WATS typically renders company cards with job listings inside
    const companyCards = $(
      '[data-company], .company-card, .company-row, .directory-list > div, .companies-list > div'
    );

    companyCards.each((_i, card) => {
      try {
        const $card = $(card);

        // Extract company info
        const companyName = $card.find(
          '.company-name, h2, h3, [data-company-name], .name'
        ).first().text().trim();

        if (!companyName || companyName.length < 2) return;

        const key = companyName.toLowerCase();
        if (!companySet.has(key)) {
          companySet.add(key);

          const sizeText = $card.find(
            '.team-size, .company-size, [data-team-size]'
          ).text();
          const size = parseCompanySize(sizeText);

          companies.push({
            name: companyName,
            website: $card.find('a[href*="http"]').first().attr('href') || undefined,
            description: $card.find(
              '.company-description, .one-liner, .tagline, p'
            ).first().text().trim() || undefined,
            funding_stage: parseFundingStage(
              $card.find('.stage, .funding, [data-stage]').text()
            ),
            headcount_min: size.min,
            headcount_max: size.max,
            location: $card.find('.location, [data-location]').text().trim() || undefined,
            logo_url: $card.find('img').first().attr('src') || undefined,
            industry: $card.find('.industry, .vertical, .tag').first().text().trim() || undefined,
          });
        }

        // Extract job listings within the company card
        const jobElements = $card.find(
          '.job, .job-listing, .role, [data-job], a[href*="/jobs/"]'
        );

        if (jobElements.length > 0) {
          jobElements.each((_j, jobEl) => {
            const $job = $(jobEl);
            const title = $job.find('.job-title, .role-title, h4, h5').text().trim()
              || $job.text().trim();

            if (!title || title.length < 3) return;

            const href = $job.attr('href') || $job.find('a').first().attr('href');
            const jobUrl = href
              ? (href.startsWith('http') ? href : `${this.BASE_URL}${href}`)
              : `${this.BASE_URL}/companies`;

            const locationText = $job.find('.location, .job-location').text().trim();

            jobs.push({
              title,
              company_name: companyName,
              location: locationText || undefined,
              remote_type: parseRemoteType(locationText || $job.text()),
              url: jobUrl,
              source: this.name,
            });
          });
        } else {
          // No individual jobs found - create a generic entry
          jobs.push({
            title: 'Open Positions',
            company_name: companyName,
            url: $card.find('a').first().attr('href')
              ? `${this.BASE_URL}${$card.find('a').first().attr('href')}`
              : `${this.BASE_URL}/companies`,
            source: this.name,
          });
        }
      } catch (err) {
        this.logError('Failed to parse company card', err);
      }
    });

    return { jobs, companies };
  }

  private parseFallback(
    $: CheerioAPI,
    companySet: Set<string>
  ): { jobs: RawJob[]; companies: RawCompany[] } {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];

    this.log('Running fallback link extraction...');

    // Extract all links that look like company/job pages
    $('a[href]').each((_i, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const text = $a.text().trim();

        // Look for links to company or job pages
        if (
          (href.includes('/companies/') || href.includes('/jobs/')) &&
          text.length > 2 &&
          text.length < 100
        ) {
          const fullUrl = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;

          // Determine if this is a job or company link
          if (href.includes('/jobs/')) {
            // Extract company name from nearby context
            const parentText = $a.closest('div, li, tr').text();
            const companyGuess = $a.closest('div, li, tr')
              .find('h2, h3, h4, .company-name, strong, b')
              .first().text().trim();

            jobs.push({
              title: text,
              company_name: companyGuess || 'Unknown',
              url: fullUrl,
              source: this.name,
              remote_type: parseRemoteType(parentText),
            });
          } else if (href.includes('/companies/') && !companySet.has(text.toLowerCase())) {
            companySet.add(text.toLowerCase());
            companies.push({
              name: text,
              website: fullUrl,
            });
          }
        }
      } catch {
        // Skip individual link errors
      }
    });

    return { jobs, companies };
  }
}
