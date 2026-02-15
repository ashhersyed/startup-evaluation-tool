import axios, { AxiosInstance } from 'axios';

interface CareerPageResult {
  url: string;
  type: 'careers-page' | 'greenhouse' | 'lever' | 'personio' | 'recruitee' | 'other';
}

export class CareerPageFinder {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 10000,
      maxRedirects: 3,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  }

  async findCareerPages(companyName: string, website?: string): Promise<string[]> {
    const results: CareerPageResult[] = [];
    const slug = this.toSlug(companyName);

    const checks: Array<{ url: string; type: CareerPageResult['type'] }> = [];

    // If a website is provided, try common career page paths
    if (website) {
      const base = website.replace(/\/+$/, '');
      checks.push(
        { url: `${base}/careers`, type: 'careers-page' },
        { url: `${base}/jobs`, type: 'careers-page' },
        { url: `${base}/careers/open-positions`, type: 'careers-page' },
        { url: `${base}/company/careers`, type: 'careers-page' },
        { url: `${base}/about/careers`, type: 'careers-page' },
        { url: `${base}/join`, type: 'careers-page' },
        { url: `${base}/join-us`, type: 'careers-page' },
        { url: `${base}/work-with-us`, type: 'careers-page' },
      );
    }

    // Try well-known ATS platforms
    checks.push(
      { url: `https://boards.greenhouse.io/${slug}`, type: 'greenhouse' },
      { url: `https://jobs.lever.co/${slug}`, type: 'lever' },
      { url: `https://${slug}.jobs.personio.com`, type: 'personio' },
      { url: `https://${slug}.recruitee.com`, type: 'recruitee' },
    );

    // Also try some slug variations
    const altSlug = slug.replace(/-/g, '');
    if (altSlug !== slug) {
      checks.push(
        { url: `https://boards.greenhouse.io/${altSlug}`, type: 'greenhouse' },
        { url: `https://jobs.lever.co/${altSlug}`, type: 'lever' },
      );
    }

    // Run all checks concurrently in batches to avoid overwhelming targets
    const batchSize = 5;
    for (let i = 0; i < checks.length; i += batchSize) {
      const batch = checks.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(async (check) => {
          const exists = await this.urlExists(check.url);
          if (exists) {
            return check;
          }
          return null;
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      }
    }

    return results.map(r => r.url);
  }

  private async urlExists(url: string): Promise<boolean> {
    try {
      const response = await this.http.head(url, {
        validateStatus: (status) => status < 400,
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      // HEAD might be blocked; try GET with a small response
      try {
        const response = await this.http.get(url, {
          validateStatus: (status) => status < 400,
          maxContentLength: 10000,
          headers: { Range: 'bytes=0-1000' },
        });
        return response.status >= 200 && response.status < 400;
      } catch {
        return false;
      }
    }
  }

  private toSlug(companyName: string): string {
    return companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
