import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

interface RemoteOKJob {
  id?: string;
  slug?: string;
  epoch?: number;
  date?: string;
  company?: string;
  company_logo?: string;
  position?: string;
  description?: string;
  location?: string;
  salary_min?: number;
  salary_max?: number;
  tags?: string[];
  url?: string;
  original?: boolean;
}

export default class RemoteOKScraper extends BaseScraper {
  name = 'remoteok';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const companySet = new Set<string>();

    try {
      this.log('Fetching RemoteOK API...');

      const data = await this.fetchJson<RemoteOKJob[]>('https://remoteok.com/api');

      // First element is usually a legal notice / metadata object, skip it
      const listings = data.filter(item => item.position && item.company);

      this.log(`Found ${listings.length} job listings`);

      for (const listing of listings) {
        try {
          const parsed = this.parseListing(listing);
          if (parsed) {
            jobs.push(parsed.job);
            const key = parsed.company.name.toLowerCase();
            if (!companySet.has(key)) {
              companySet.add(key);
              companies.push(parsed.company);
            }
          }
        } catch (err) {
          this.logError(`Failed to parse listing ${listing.id || listing.slug}`, err);
        }
      }

      this.log(`Parsed ${jobs.length} jobs from ${companies.length} companies`);
    } catch (err) {
      this.logError('Failed to scrape RemoteOK', err);
    }

    return { jobs, companies };
  }

  private parseListing(listing: RemoteOKJob): { job: RawJob; company: RawCompany } | null {
    const companyName = (listing.company || '').trim();
    const title = (listing.position || '').trim();

    if (!companyName || !title) return null;

    // Build the job URL
    const jobUrl = listing.url
      ? (listing.url.startsWith('http') ? listing.url : `https://remoteok.com${listing.url}`)
      : listing.slug
        ? `https://remoteok.com/remote-jobs/${listing.slug}`
        : `https://remoteok.com/remote-jobs/${listing.id || ''}`;

    // Clean HTML from description
    const description = listing.description ? cleanText(listing.description).substring(0, 3000) : undefined;

    // Determine location - RemoteOK is all remote but may specify region
    const location = listing.location || 'Remote';
    const remoteType = parseRemoteType(location) || 'remote';

    // Parse posted date
    let postedAt: string | undefined;
    if (listing.date) {
      postedAt = listing.date;
    } else if (listing.epoch) {
      postedAt = new Date(listing.epoch * 1000).toISOString();
    }

    const job: RawJob = {
      title,
      company_name: companyName,
      description,
      location,
      remote_type: remoteType,
      salary_min: listing.salary_min && listing.salary_min > 0 ? listing.salary_min : undefined,
      salary_max: listing.salary_max && listing.salary_max > 0 ? listing.salary_max : undefined,
      salary_currency: (listing.salary_min || listing.salary_max) ? 'USD' : undefined,
      url: jobUrl,
      source: this.name,
      source_id: listing.id || listing.slug || undefined,
      posted_at: postedAt,
    };

    const company: RawCompany = {
      name: companyName,
      logo_url: listing.company_logo || undefined,
      industry: listing.tags && listing.tags.length > 0 ? listing.tags[0] : undefined,
    };

    return { job, company };
  }
}
