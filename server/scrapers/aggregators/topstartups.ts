import * as cheerio from 'cheerio';
import { BaseScraper, ScraperResult, RawCompany, parseFundingStage, parseCompanySize, cleanText } from '../base.js';

const INVESTOR_FILTERS = [
  'Andreessen+Horowitz',
  'Sequoia+Capital',
  'Y+Combinator',
  'Accel',
  'Benchmark',
  'Founders+Fund',
  'Lightspeed+Venture+Partners',
  'Index+Ventures',
  'Bessemer+Venture+Partners',
  'Greylock+Partners',
];

export default class TopStartupsScraper extends BaseScraper {
  name = 'topstartups';

  async scrape(): Promise<ScraperResult> {
    const companies: RawCompany[] = [];
    const seenCompanies = new Set<string>();

    // Scrape the main page first
    try {
      this.log('Fetching main page...');
      const mainCompanies = await this.scrapePage('https://topstartups.io/');
      for (const company of mainCompanies) {
        const key = company.name.toLowerCase();
        if (!seenCompanies.has(key)) {
          seenCompanies.add(key);
          companies.push(company);
        }
      }
      this.log(`Found ${mainCompanies.length} companies on main page`);
    } catch (err) {
      this.logError('Failed to scrape main page', err);
    }

    // Scrape investor-filtered pages
    for (const investor of INVESTOR_FILTERS) {
      try {
        const url = `https://topstartups.io/?investors=${investor}`;
        this.log(`Fetching companies backed by ${investor.replace(/\+/g, ' ')}...`);
        const investorCompanies = await this.scrapePage(url);

        let added = 0;
        for (const company of investorCompanies) {
          const key = company.name.toLowerCase();
          if (!seenCompanies.has(key)) {
            seenCompanies.add(key);
            // Annotate investor info if not already present
            if (!company.investors || company.investors.length === 0) {
              company.investors = [investor.replace(/\+/g, ' ')];
            }
            companies.push(company);
            added++;
          }
        }
        this.log(`Found ${investorCompanies.length} companies (${added} new) for ${investor.replace(/\+/g, ' ')}`);
        await this.delay(800);
      } catch (err) {
        this.logError(`Failed to scrape investor page: ${investor}`, err);
        await this.delay(1000);
      }
    }

    this.log(`Scrape complete: ${companies.length} unique companies`);
    return { jobs: [], companies };
  }

  private async scrapePage(url: string): Promise<RawCompany[]> {
    const companies: RawCompany[] = [];
    const $ = await this.fetchHtml(url);

    // Try common selectors for startup cards/rows
    const selectors = [
      '.startup-card',
      '.company-card',
      '[data-company]',
      'table tbody tr',
      '.list-item',
      '.startup-row',
      'article',
    ];

    let $items: cheerio.Cheerio<any> | null = null;
    for (const sel of selectors) {
      const found = $(sel);
      if (found.length > 0) {
        $items = found;
        break;
      }
    }

    if (!$items || $items.length === 0) {
      // Fallback: try to parse any structured data from the page
      this.log(`No matching selectors found for ${url}, trying generic extraction`);
      return this.extractFromGenericHtml($, url);
    }

    $items.each((_i, el) => {
      try {
        const $el = $(el);
        const name = cleanText(
          $el.find('h2, h3, .company-name, .startup-name, [data-name], td:first-child a').first().text()
        );
        if (!name || name.length < 2) return;

        const description = cleanText(
          $el.find('p, .description, .company-description, td:nth-child(2)').first().text()
        );

        const fundingText = cleanText(
          $el.find('.funding, .stage, .funding-stage, [data-funding]').first().text()
        );

        const valuationText = cleanText(
          $el.find('.valuation, [data-valuation]').first().text()
        );

        const employeeText = cleanText(
          $el.find('.employees, .headcount, .team-size, [data-employees]').first().text()
        );

        const industryText = cleanText(
          $el.find('.industry, .category, .sector, [data-industry]').first().text()
        );

        const investorsText = cleanText(
          $el.find('.investors, [data-investors]').first().text()
        );

        const locationText = cleanText(
          $el.find('.location, [data-location]').first().text()
        );

        const website = $el.find('a[href^="http"]').first().attr('href') || undefined;
        const logoUrl = $el.find('img').first().attr('src') || undefined;

        const headcount = parseCompanySize(employeeText);

        const company: RawCompany = {
          name,
          description: description || undefined,
          funding_stage: parseFundingStage(fundingText) || undefined,
          total_raised: valuationText || undefined,
          headcount_min: headcount.min,
          headcount_max: headcount.max,
          location: locationText || undefined,
          investors: investorsText
            ? investorsText.split(/[,;]/).map(s => s.trim()).filter(Boolean)
            : undefined,
          industry: industryText || undefined,
          website,
          logo_url: logoUrl,
        };

        companies.push(company);
      } catch (err) {
        // Skip malformed entries
      }
    });

    return companies;
  }

  private extractFromGenericHtml($: any, url: string): RawCompany[] {
    const companies: RawCompany[] = [];

    // Try to find structured data (JSON-LD)
    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const data = JSON.parse($(el).html() || '');
        if (data['@type'] === 'Organization' || data['@type'] === 'Corporation') {
          companies.push({
            name: data.name,
            description: data.description,
            website: data.url,
            logo_url: data.logo,
            location: data.address?.addressLocality,
          });
        }
      } catch {
        // Invalid JSON-LD
      }
    });

    // Also try Open Graph meta tags for company pages
    const ogName = $('meta[property="og:site_name"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    if (ogName && ogName !== 'TopStartups' && ogName.length > 1) {
      companies.push({
        name: ogName,
        description: ogDescription || undefined,
      });
    }

    return companies;
  }
}
