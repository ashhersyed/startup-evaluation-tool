import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, cleanText } from '../base.js';

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  absolute_url: string;
  location: {
    name: string;
  };
  content: string;
  departments: Array<{ name: string }>;
  offices: Array<{ name: string; location: string }>;
}

interface GreenhouseBoardResponse {
  jobs: GreenhouseJob[];
  meta?: {
    total: number;
  };
}

export const DEFAULT_GREENHOUSE_SLUGS = [
  'notion',
  'figma',
  'stripe',
  'vercel',
  'linear',
  'retool',
  'airtable',
  'databricks',
  'plaid',
  'rippling',
  'ramp',
  'brex',
  'scale',
  'anduril',
  'anthropic',
  'openai',
  'mistral',
  'cohere',
  'midjourney',
  'runway',
  'huggingface',
  'dbt-labs',
  'hashicorp',
  'datadog',
  'snowflake',
  'clickhouse',
  'supabase',
  'planetscale',
  'neon',
  'turso',
];

export default class GreenhouseScraper extends BaseScraper {
  name = 'greenhouse';

  private slugs: string[];

  constructor(slugs?: string[]) {
    super();
    this.slugs = slugs ?? DEFAULT_GREENHOUSE_SLUGS;
  }

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const seenCompanies = new Set<string>();

    this.log(`Starting scrape for ${this.slugs.length} company boards`);

    for (const slug of this.slugs) {
      try {
        this.log(`Fetching jobs for ${slug}...`);
        const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
        const data = await this.fetchJson<GreenhouseBoardResponse>(url);

        if (!data.jobs || data.jobs.length === 0) {
          this.log(`No jobs found for ${slug}`);
          await this.delay(100);
          continue;
        }

        const companyName = this.slugToCompanyName(slug);

        if (!seenCompanies.has(companyName.toLowerCase())) {
          seenCompanies.add(companyName.toLowerCase());
          companies.push({
            name: companyName,
            website: `https://boards.greenhouse.io/${slug}`,
          });
        }

        for (const job of data.jobs) {
          const locationName = job.location?.name || '';
          const description = cleanText(job.content || '');

          jobs.push({
            title: job.title,
            company_name: companyName,
            description: description.substring(0, 3000),
            location: locationName || undefined,
            remote_type: parseRemoteType(locationName + ' ' + job.title),
            url: job.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${job.id}`,
            source: this.name,
            source_id: `gh-${slug}-${job.id}`,
            posted_at: job.updated_at,
          });
        }

        this.log(`Found ${data.jobs.length} jobs for ${slug}`);
        await this.delay(200);
      } catch (err) {
        this.logError(`Failed to fetch jobs for ${slug}`, err);
        await this.delay(300);
      }
    }

    this.log(`Scrape complete: ${jobs.length} jobs from ${companies.length} companies`);
    return { jobs, companies };
  }

  private slugToCompanyName(slug: string): string {
    const overrides: Record<string, string> = {
      'dbt-labs': 'dbt Labs',
      'openai': 'OpenAI',
      'huggingface': 'Hugging Face',
      'hashicorp': 'HashiCorp',
      'datadog': 'Datadog',
      'snowflake': 'Snowflake',
      'clickhouse': 'ClickHouse',
      'supabase': 'Supabase',
      'planetscale': 'PlanetScale',
      'databricks': 'Databricks',
      'anthropic': 'Anthropic',
      'midjourney': 'Midjourney',
      'anduril': 'Anduril',
      'rippling': 'Rippling',
    };

    if (overrides[slug]) return overrides[slug];

    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
