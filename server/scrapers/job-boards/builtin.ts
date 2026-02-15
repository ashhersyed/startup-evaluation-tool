import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';
import type { CheerioAPI } from 'cheerio';

export default class BuiltInScraper extends BaseScraper {
  name = 'builtin';

  private readonly BASE_URL = 'https://builtin.com';

  private readonly PAGES = [
    'https://builtin.com/jobs/remote',
    'https://builtin.com/jobs',
  ];

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const companySet = new Set<string>();
    const seenUrls = new Set<string>();

    for (const pageUrl of this.PAGES) {
      try {
        await this.scrapePage(pageUrl, jobs, companies, companySet, seenUrls);
      } catch (err) {
        this.logError(`Failed to scrape ${pageUrl}`, err);
      }

      await this.delay(2000);
    }

    this.log(`Total: ${jobs.length} jobs from ${companies.length} companies`);
    return { jobs, companies };
  }

  private async scrapePage(
    baseUrl: string,
    jobs: RawJob[],
    companies: RawCompany[],
    companySet: Set<string>,
    seenUrls: Set<string>,
    maxPages = 3
  ): Promise<void> {
    for (let page = 0; page < maxPages; page++) {
      const url = page === 0 ? baseUrl : `${baseUrl}?page=${page}`;
      this.log(`Fetching ${url}...`);

      try {
        const $ = await this.fetchHtml(url);

        const pageJobs = this.parseJobListings($, companySet, companies, seenUrls);

        if (pageJobs.length === 0) {
          this.log(`No jobs found on page ${page}, stopping pagination`);
          break;
        }

        jobs.push(...pageJobs);
        this.log(`Found ${pageJobs.length} jobs on page ${page}`);

        if (page < maxPages - 1) {
          await this.delay(2000);
        }
      } catch (err) {
        this.logError(`Failed to fetch page ${page} of ${baseUrl}`, err);
        break;
      }
    }
  }

  private parseJobListings(
    $: CheerioAPI,
    companySet: Set<string>,
    companies: RawCompany[],
    seenUrls: Set<string>
  ): RawJob[] {
    const jobs: RawJob[] = [];

    // BuiltIn uses various card layouts; try multiple selector strategies
    const jobCards = $(
      '[data-id="job-card"], .job-card, .job-listing, ' +
      '[class*="JobCard"], [class*="job-result"], ' +
      'article[class*="job"], div[class*="views-row"]'
    );

    if (jobCards.length > 0) {
      jobCards.each((_i, card) => {
        try {
          const parsed = this.parseCard($, card, companySet, companies, seenUrls);
          if (parsed) jobs.push(parsed);
        } catch (err) {
          this.logError('Failed to parse job card', err);
        }
      });
    } else {
      // Fallback: look for structured job listings in any repeating container
      this.log('Primary selectors missed, trying broader fallback...');
      const fallbackJobs = this.parseFallback($, companySet, companies, seenUrls);
      jobs.push(...fallbackJobs);
    }

    return jobs;
  }

  private parseCard(
    $: CheerioAPI,
    card: any,
    companySet: Set<string>,
    companies: RawCompany[],
    seenUrls: Set<string>
  ): RawJob | null {
    const $card = $(card);

    // Job title
    const title = $card.find(
      'h2 a, h3 a, .job-title, [class*="job-title"], ' +
      '[data-id="job-title"], [class*="JobTitle"], a[class*="title"]'
    ).first().text().trim()
      || $card.find('h2, h3').first().text().trim();

    if (!title || title.length < 3) return null;

    // Company name
    const companyName = $card.find(
      '.company-name, [class*="company-name"], [data-id="company-name"], ' +
      '[class*="CompanyName"], .company-title, span[class*="company"]'
    ).first().text().trim()
      || $card.find('.company a, [class*="employer"]').first().text().trim();

    if (!companyName || companyName.length < 2) return null;

    // Job URL
    const href = $card.find(
      'h2 a, h3 a, a[class*="title"], a[href*="/job/"], a[href*="/jobs/"]'
    ).first().attr('href');

    const jobUrl = href
      ? (href.startsWith('http') ? href : `${this.BASE_URL}${href}`)
      : `${this.BASE_URL}/jobs`;

    if (seenUrls.has(jobUrl)) return null;
    seenUrls.add(jobUrl);

    // Location
    const locationText = $card.find(
      '.job-location, [class*="location"], [data-id="location"], ' +
      '[class*="Location"], .location'
    ).first().text().trim();

    // Remote status
    const cardText = $card.text();
    const remoteType = parseRemoteType(locationText + ' ' + cardText);

    // Experience level
    const experienceText = $card.find(
      '.experience, [class*="experience"], [class*="seniority"], ' +
      '[data-id="experience"], [class*="level"]'
    ).first().text().trim();

    // Build description with experience level
    let description: string | undefined;
    if (experienceText) {
      description = `Experience Level: ${experienceText}`;
    }

    // Category / department
    const category = $card.find(
      '.category, [class*="category"], [class*="department"]'
    ).first().text().trim();

    if (category && description) {
      description += ` | Category: ${category}`;
    } else if (category) {
      description = `Category: ${category}`;
    }

    // Company entry
    const key = companyName.toLowerCase();
    if (!companySet.has(key)) {
      companySet.add(key);

      const companyLogo = $card.find('img').first().attr('src') || undefined;
      const companyHref = $card.find(
        'a[href*="/company/"], a[href*="/companies/"]'
      ).first().attr('href');

      companies.push({
        name: companyName,
        website: companyHref
          ? (companyHref.startsWith('http') ? companyHref : `${this.BASE_URL}${companyHref}`)
          : undefined,
        location: locationText || undefined,
        logo_url: companyLogo,
        industry: category || undefined,
      });
    }

    return {
      title: cleanText(title),
      company_name: companyName,
      description,
      location: locationText || undefined,
      remote_type: remoteType,
      url: jobUrl,
      source: this.name,
    };
  }

  private parseFallback(
    $: CheerioAPI,
    companySet: Set<string>,
    companies: RawCompany[],
    seenUrls: Set<string>
  ): RawJob[] {
    const jobs: RawJob[] = [];

    // Look for any anchor tags linking to job detail pages
    $('a[href*="/job/"], a[href*="/jobs/"]').each((_i, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const text = $a.text().trim();

        // Skip nav/footer links and very short/long text
        if (text.length < 4 || text.length > 150) return;
        if (/sign|login|register|privacy|terms|about|browse|search|all jobs/i.test(text)) return;

        const fullUrl = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        // Try to find company name from surrounding context
        const container = $a.closest('div, li, article, section');
        const companyName = container.find(
          '[class*="company"], strong, b, .employer'
        ).first().text().trim() || 'Unknown';

        const key = companyName.toLowerCase();
        if (!companySet.has(key) && companyName !== 'Unknown') {
          companySet.add(key);
          companies.push({ name: companyName });
        }

        const containerText = container.text();

        jobs.push({
          title: cleanText(text),
          company_name: companyName,
          url: fullUrl,
          source: this.name,
          remote_type: parseRemoteType(containerText),
          location: undefined,
        });
      } catch {
        // Skip individual link errors
      }
    });

    return jobs;
  }
}
