import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt: number;
  descriptionPlain?: string;
  description?: string;
  additional?: string;
  additionalPlain?: string;
  categories: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
    allLocations?: string[];
  };
  tags?: string[];
}

export const DEFAULT_LEVER_SLUGS = [
  'netlify',
  'prisma',
  'temporal',
  'materialize',
  'cockroachlabs',
  'samsara',
  'verkada',
  'applied-intuition',
  'faire',
  'wiz-inc',
  'lacework',
  'snyk',
  'grafana',
  'mux',
  'axiom',
  'resend',
  'clerk',
  'convex',
  'liveblocks',
  'tldraw',
];

export default class LeverScraper extends BaseScraper {
  name = 'lever';

  private slugs: string[];

  constructor(slugs?: string[]) {
    super();
    this.slugs = slugs ?? DEFAULT_LEVER_SLUGS;
  }

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const seenCompanies = new Set<string>();

    this.log(`Starting scrape for ${this.slugs.length} company boards`);

    for (const slug of this.slugs) {
      try {
        this.log(`Fetching jobs for ${slug}...`);
        const url = `https://api.lever.co/v0/postings/${slug}`;
        const postings = await this.fetchJson<LeverPosting[]>(url);

        if (!postings || postings.length === 0) {
          this.log(`No jobs found for ${slug}`);
          await this.delay(100);
          continue;
        }

        const companyName = this.slugToCompanyName(slug);

        if (!seenCompanies.has(companyName.toLowerCase())) {
          seenCompanies.add(companyName.toLowerCase());
          companies.push({
            name: companyName,
            website: `https://jobs.lever.co/${slug}`,
          });
        }

        for (const posting of postings) {
          const location = posting.categories?.location || '';
          const team = posting.categories?.team || '';
          const description = cleanText(posting.descriptionPlain || posting.description || '');

          jobs.push({
            title: posting.text,
            company_name: companyName,
            description: description.substring(0, 3000),
            location: location || undefined,
            remote_type: parseRemoteType(
              [location, posting.categories?.commitment || '', posting.text].join(' ')
            ),
            url: posting.hostedUrl || `https://jobs.lever.co/${slug}/${posting.id}`,
            source: this.name,
            source_id: `lever-${slug}-${posting.id}`,
            posted_at: posting.createdAt
              ? new Date(posting.createdAt).toISOString()
              : undefined,
          });
        }

        this.log(`Found ${postings.length} jobs for ${slug} (team: ${this.getTeamSummary(postings)})`);
        await this.delay(200);
      } catch (err) {
        this.logError(`Failed to fetch jobs for ${slug}`, err);
        await this.delay(300);
      }
    }

    this.log(`Scrape complete: ${jobs.length} jobs from ${companies.length} companies`);
    return { jobs, companies };
  }

  private getTeamSummary(postings: LeverPosting[]): string {
    const teams = new Set<string>();
    for (const p of postings) {
      if (p.categories?.team) teams.add(p.categories.team);
    }
    const arr = [...teams];
    if (arr.length <= 3) return arr.join(', ') || 'N/A';
    return `${arr.slice(0, 3).join(', ')} +${arr.length - 3} more`;
  }

  private slugToCompanyName(slug: string): string {
    const overrides: Record<string, string> = {
      'cockroachlabs': 'CockroachDB',
      'wiz-inc': 'Wiz',
      'applied-intuition': 'Applied Intuition',
      'grafana': 'Grafana Labs',
      'dbt-labs': 'dbt Labs',
      'tldraw': 'tldraw',
    };

    if (overrides[slug]) return overrides[slug];

    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
