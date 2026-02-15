import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, parseSalary, parseFundingStage, parseCompanySize, cleanText } from '../base.js';
import type { CheerioAPI } from 'cheerio';

export default class WellfoundScraper extends BaseScraper {
  name = 'wellfound';

  private readonly BASE_URL = 'https://wellfound.com';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const companySet = new Set<string>();

    try {
      this.log('Fetching Wellfound jobs page...');

      // Wellfound uses SSR with embedded Apollo/GraphQL data; try HTML scrape first
      const $ = await this.fetchHtml(`${this.BASE_URL}/jobs`);

      // Try extracting from embedded JSON (Next.js __NEXT_DATA__ or Apollo state)
      const embeddedResult = this.parseEmbeddedJson($, companySet);
      if (embeddedResult && embeddedResult.jobs.length > 0) {
        this.log(`Extracted ${embeddedResult.jobs.length} jobs from embedded JSON`);
        return embeddedResult;
      }

      // Fall back to HTML selector-based scraping
      this.log('No embedded JSON found, trying HTML selectors...');
      let parsed = this.parseWithSelectors($, companySet);

      // If selectors fail, try a broader fallback
      if (parsed.jobs.length === 0) {
        this.log('Primary selectors returned no results, trying fallback...');
        parsed = this.parseFallback($, companySet);
      }

      jobs.push(...parsed.jobs);
      companies.push(...parsed.companies);

      // Try paginating if we got results
      if (jobs.length > 0) {
        for (let page = 2; page <= 5; page++) {
          try {
            this.log(`Fetching page ${page}...`);
            await this.delay(2000);

            const $page = await this.fetchHtml(`${this.BASE_URL}/jobs?page=${page}`);
            const pageResult = this.parseWithSelectors($page, companySet);

            if (pageResult.jobs.length === 0) break;

            jobs.push(...pageResult.jobs);
            companies.push(...pageResult.companies);
          } catch (err) {
            this.logError(`Failed to fetch page ${page}`, err);
            break;
          }
        }
      }

      this.log(`Parsed ${jobs.length} jobs from ${companies.length} companies`);
    } catch (err) {
      this.logError('Failed to scrape Wellfound', err);
    }

    return { jobs, companies };
  }

  private parseEmbeddedJson(
    $: CheerioAPI,
    companySet: Set<string>
  ): ScraperResult | null {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];

    try {
      // Look for Next.js embedded data
      const nextDataScript = $('#__NEXT_DATA__').html();
      if (nextDataScript) {
        const nextData = JSON.parse(nextDataScript);
        const pageProps = nextData?.props?.pageProps;

        // Navigate to jobs data (structure may vary)
        const jobListings = pageProps?.listings || pageProps?.jobs || pageProps?.startupJobs || [];

        if (Array.isArray(jobListings) && jobListings.length > 0) {
          for (const listing of jobListings) {
            try {
              const companyName = listing.startup?.name || listing.company?.name || listing.companyName;
              const title = listing.title || listing.role || listing.jobTitle;
              if (!companyName || !title) continue;

              const key = companyName.toLowerCase();
              if (!companySet.has(key)) {
                companySet.add(key);
                const startup = listing.startup || listing.company || {};
                const size = parseCompanySize(startup.company_size || startup.size || '');
                companies.push({
                  name: companyName,
                  website: startup.company_url || startup.website || undefined,
                  description: startup.product_desc || startup.high_concept || startup.description || undefined,
                  funding_stage: parseFundingStage(startup.stage || ''),
                  headcount_min: size.min,
                  headcount_max: size.max,
                  location: startup.location_tags?.join(', ') || startup.location || undefined,
                  logo_url: startup.logo_url || undefined,
                  industry: startup.markets?.join(', ') || startup.industry || undefined,
                });
              }

              const salary = parseSalary(listing.salary || listing.compensation || '');
              const locationStr = listing.location || listing.locations?.join(', ') || '';

              jobs.push({
                title,
                company_name: companyName,
                description: cleanText(listing.description || '').substring(0, 3000),
                location: locationStr || undefined,
                remote_type: parseRemoteType(listing.remote || locationStr),
                salary_min: listing.salary_min || salary.min,
                salary_max: listing.salary_max || salary.max,
                salary_currency: salary.currency || 'USD',
                url: listing.url
                  ? (listing.url.startsWith('http') ? listing.url : `${this.BASE_URL}${listing.url}`)
                  : `${this.BASE_URL}/jobs`,
                source: this.name,
                source_id: listing.id ? String(listing.id) : undefined,
                posted_at: listing.created_at || listing.posted_at || undefined,
              });
            } catch (err) {
              this.logError('Failed to parse embedded listing', err);
            }
          }
          return { jobs, companies };
        }
      }

      // Try Apollo state cache
      $('script').each((_i, el) => {
        const scriptContent = $(el).html() || '';
        if (scriptContent.includes('window.__APOLLO_STATE__') || scriptContent.includes('__APOLLO_STATE__')) {
          try {
            const match = scriptContent.match(/__APOLLO_STATE__\s*=\s*({[\s\S]+?});?\s*(?:<\/script>|$)/);
            if (match) {
              const apolloState = JSON.parse(match[1]);
              // Apollo state stores entities by typename:id
              for (const [key, value] of Object.entries(apolloState)) {
                if (key.startsWith('StartupResult:') || key.startsWith('JobListing:')) {
                  const entry = value as any;
                  if (entry.title && entry.startup) {
                    const startupRef = apolloState[entry.startup?.__ref] as any;
                    const companyName = startupRef?.name || 'Unknown';

                    if (companyName !== 'Unknown') {
                      const cKey = companyName.toLowerCase();
                      if (!companySet.has(cKey)) {
                        companySet.add(cKey);
                        companies.push({
                          name: companyName,
                          website: startupRef?.companyUrl || undefined,
                          description: startupRef?.highConcept || undefined,
                          funding_stage: parseFundingStage(startupRef?.stage || ''),
                          logo_url: startupRef?.logoUrl || undefined,
                        });
                      }
                    }

                    jobs.push({
                      title: entry.title,
                      company_name: companyName,
                      description: cleanText(entry.description || '').substring(0, 3000),
                      location: entry.locationNames?.join(', ') || undefined,
                      remote_type: parseRemoteType(entry.remote ? 'remote' : ''),
                      salary_min: entry.salaryMin || undefined,
                      salary_max: entry.salaryMax || undefined,
                      salary_currency: 'USD',
                      url: entry.slug
                        ? `${this.BASE_URL}/jobs/${entry.slug}`
                        : `${this.BASE_URL}/jobs`,
                      source: this.name,
                      source_id: entry.id ? String(entry.id) : undefined,
                    });
                  }
                }
              }
            }
          } catch {
            // Apollo parse failed, continue
          }
        }
      });

      if (jobs.length > 0) return { jobs, companies };
    } catch {
      // Embedded JSON extraction failed entirely
    }

    return null;
  }

  private parseWithSelectors(
    $: CheerioAPI,
    companySet: Set<string>
  ): { jobs: RawJob[]; companies: RawCompany[] } {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];

    // Wellfound job cards - try multiple possible selector patterns
    const jobCards = $(
      '[data-test="StartupResult"], .job-listing, .styles_component__job, ' +
      '.job-card, [class*="JobCard"], [class*="job-listing"], [class*="StartupResult"]'
    );

    jobCards.each((_i, card) => {
      try {
        const $card = $(card);

        // Company name
        const companyName = $card.find(
          '[data-test="StartupResult-name"], .startup-link, .company-name, ' +
          'h2 a, h3, [class*="company"], [class*="startup-name"]'
        ).first().text().trim();

        if (!companyName || companyName.length < 2) return;

        // Job title
        const title = $card.find(
          '[data-test="JobListing-title"], .job-title, .listing-title, ' +
          'h4, [class*="jobTitle"], [class*="role-title"]'
        ).first().text().trim();

        if (!title || title.length < 2) return;

        // Salary
        const salaryText = $card.find(
          '.salary, [class*="salary"], [class*="compensation"], [data-test*="salary"]'
        ).text().trim();
        const salary = parseSalary(salaryText);

        // Equity
        const equityText = $card.find(
          '.equity, [class*="equity"]'
        ).text().trim();

        // Location
        const locationText = $card.find(
          '.location, [class*="location"], [data-test*="location"]'
        ).text().trim();

        // Remote
        const remoteType = parseRemoteType(
          $card.find('[class*="remote"], .remote-badge, .tag').text() + ' ' + locationText
        );

        // Company details
        const key = companyName.toLowerCase();
        if (!companySet.has(key)) {
          companySet.add(key);

          const sizeText = $card.find(
            '.company-size, [class*="size"], [class*="employees"]'
          ).text().trim();
          const size = parseCompanySize(sizeText);

          const stageText = $card.find(
            '.stage, [class*="stage"], [class*="funding"]'
          ).text().trim();

          companies.push({
            name: companyName,
            description: $card.find(
              '.tagline, .one-liner, [class*="highConcept"], [class*="tagline"]'
            ).first().text().trim() || undefined,
            funding_stage: parseFundingStage(stageText),
            headcount_min: size.min,
            headcount_max: size.max,
            location: locationText || undefined,
            logo_url: $card.find('img').first().attr('src') || undefined,
            industry: $card.find(
              '.market-tag, [class*="market"], [class*="industry"]'
            ).first().text().trim() || undefined,
          });
        }

        // Build URL
        const href = $card.find('a[href*="/jobs/"], a[href*="/l/"]').first().attr('href');
        const jobUrl = href
          ? (href.startsWith('http') ? href : `${this.BASE_URL}${href}`)
          : `${this.BASE_URL}/jobs`;

        jobs.push({
          title,
          company_name: companyName,
          description: equityText ? `Equity: ${equityText}` : undefined,
          location: locationText || undefined,
          remote_type: remoteType,
          salary_min: salary.min,
          salary_max: salary.max,
          salary_currency: salary.currency,
          url: jobUrl,
          source: this.name,
        });
      } catch (err) {
        this.logError('Failed to parse job card', err);
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

    this.log('Running fallback link extraction for Wellfound...');

    // Broad approach: find any links to job detail pages
    $('a[href*="/jobs/"], a[href*="/l/"]').each((_i, el) => {
      try {
        const $a = $(el);
        const href = $a.attr('href') || '';
        const text = $a.text().trim();

        if (text.length < 3 || text.length > 150) return;
        // Skip navigation / footer links
        if (/sign|login|register|terms|privacy|about/i.test(text)) return;

        const fullUrl = href.startsWith('http') ? href : `${this.BASE_URL}${href}`;

        // Try to find company from parent context
        const parentEl = $a.closest('div, li, section, article');
        const companyName = parentEl.find(
          'h2, h3, strong, b, [class*="company"], [class*="startup"]'
        ).first().text().trim() || 'Unknown Startup';

        const key = companyName.toLowerCase();
        if (!companySet.has(key) && companyName !== 'Unknown Startup') {
          companySet.add(key);
          companies.push({ name: companyName });
        }

        const parentText = parentEl.text();

        jobs.push({
          title: text,
          company_name: companyName,
          url: fullUrl,
          source: this.name,
          remote_type: parseRemoteType(parentText),
          location: undefined,
        });
      } catch {
        // Skip individual link errors
      }
    });

    return { jobs, companies };
  }
}
