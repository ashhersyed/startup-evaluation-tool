import { BaseScraper, ScraperResult, RawJob, RawCompany, parseRemoteType, parseSalary, cleanText } from '../base.js';

interface HNSearchResult {
  hits: Array<{
    objectID: string;
    title: string;
    created_at: string;
    story_id?: number;
  }>;
}

interface HNCommentsResult {
  hits: Array<{
    objectID: string;
    comment_text: string;
    created_at: string;
    author: string;
    story_id: number;
    parent_id: number;
  }>;
  nbHits: number;
  nbPages: number;
}

export default class HNHiringScraper extends BaseScraper {
  name = 'hn-hiring';

  async scrape(): Promise<ScraperResult> {
    const jobs: RawJob[] = [];
    const companies: RawCompany[] = [];
    const companySet = new Set<string>();

    try {
      // Find the most recent "Who is Hiring" thread
      this.log('Searching for latest "Who is Hiring" thread...');
      const searchResult = await this.fetchJson<HNSearchResult>(
        'https://hn.algolia.com/api/v1/search_by_date?tags=story,ask_hn&query=who+is+hiring&hitsPerPage=5'
      );

      const hiringThread = searchResult.hits.find(hit =>
        /who is hiring/i.test(hit.title) && /\b(20\d{2})\b/.test(hit.title)
      );

      if (!hiringThread) {
        this.log('No "Who is Hiring" thread found');
        return { jobs, companies };
      }

      const storyId = hiringThread.objectID;
      this.log(`Found thread: "${hiringThread.title}" (ID: ${storyId})`);

      // Fetch all top-level comments (job postings) from the thread
      let page = 0;
      let totalComments = 0;
      let allComments: HNCommentsResult['hits'] = [];

      do {
        this.log(`Fetching comments page ${page}...`);
        const commentsResult = await this.fetchJson<HNCommentsResult>(
          `https://hn.algolia.com/api/v1/search?tags=comment,story_${storyId}&hitsPerPage=200&page=${page}`
        );

        allComments = allComments.concat(commentsResult.hits);
        totalComments = commentsResult.nbHits;
        page++;

        // Respect rate limits
        await this.delay(500);
      } while (allComments.length < totalComments && page < 10);

      // Filter to top-level comments only (parent_id equals story_id)
      const topLevelComments = allComments.filter(
        c => String(c.parent_id) === String(storyId)
      );

      this.log(`Found ${topLevelComments.length} top-level comments to parse`);

      for (const comment of topLevelComments) {
        try {
          const parsed = this.parseComment(comment, storyId);
          if (parsed) {
            jobs.push(parsed.job);
            if (!companySet.has(parsed.company.name.toLowerCase())) {
              companySet.add(parsed.company.name.toLowerCase());
              companies.push(parsed.company);
            }
          }
        } catch (err) {
          this.logError(`Failed to parse comment ${comment.objectID}`, err);
        }
      }

      this.log(`Parsed ${jobs.length} jobs from ${companies.length} companies`);
    } catch (err) {
      this.logError('Failed to scrape HN Hiring', err);
    }

    return { jobs, companies };
  }

  private parseComment(
    comment: HNCommentsResult['hits'][0],
    _storyId: string
  ): { job: RawJob; company: RawCompany } | null {
    const text = cleanText(comment.comment_text || '');
    if (!text || text.length < 20) return null;

    // Common format: "Company Name | Role | Location | Remote | Salary"
    // Also seen: "Company Name (https://example.com) | ..."
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';

    // Try pipe-delimited format first
    const pipeParts = firstLine.split('|').map(p => p.trim());

    let companyName: string;
    let title: string | undefined;
    let location: string | undefined;
    let remoteText = '';
    let salaryText = '';
    let website: string | undefined;

    if (pipeParts.length >= 2) {
      // Pipe-delimited format
      companyName = pipeParts[0];
      title = pipeParts.length >= 3 ? pipeParts[1] : undefined;

      for (let i = 1; i < pipeParts.length; i++) {
        const part = pipeParts[i];
        if (/remote|onsite|hybrid|on-site|in-office/i.test(part)) {
          remoteText += ' ' + part;
        } else if (/\$|€|£|salary|comp|k\b|\d{2,3}k/i.test(part)) {
          salaryText += ' ' + part;
        } else if (!title) {
          title = part;
        } else if (!location) {
          location = part;
        }
      }
    } else {
      // Non-standard format: try to extract company from first word(s)
      const nameMatch = firstLine.match(/^([A-Z][A-Za-z0-9\s&.]+?)[\s]*[-–(|]/);
      companyName = nameMatch ? nameMatch[1].trim() : firstLine.substring(0, 50).trim();
    }

    // Extract URL from company name or text
    const urlMatch = text.match(/https?:\/\/[^\s<>"')\]]+/);
    if (urlMatch) {
      website = urlMatch[0];
    }

    // Clean company name - remove URL in parentheses
    companyName = companyName
      .replace(/\s*\(https?:\/\/[^\)]+\)\s*/g, '')
      .replace(/\s*-\s*https?:\/\/\S+/g, '')
      .trim();

    if (!companyName || companyName.length < 2 || companyName.length > 100) return null;

    // If no title was found, try to find one in the body
    if (!title) {
      const roleMatch = text.match(/(?:hiring|looking for|seeking)\s+(?:a\s+)?([^.|\n]{5,60})/i);
      title = roleMatch ? roleMatch[1].trim() : 'Multiple Positions';
    }

    // Parse remote type from entire text
    const remoteType = parseRemoteType(remoteText || text);

    // Parse salary
    const salary = parseSalary(salaryText || text);

    // Extract location from text if not found
    if (!location) {
      const locMatch = text.match(/(?:based in|located in|location:?)\s+([A-Za-z\s,]{3,40})/i);
      location = locMatch ? locMatch[1].trim() : undefined;
    }

    const description = lines.slice(1).join('\n').substring(0, 2000);

    const job: RawJob = {
      title: title || 'Multiple Positions',
      company_name: companyName,
      description,
      location,
      remote_type: remoteType,
      salary_min: salary.min,
      salary_max: salary.max,
      salary_currency: salary.currency,
      url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
      source: this.name,
      source_id: comment.objectID,
      posted_at: comment.created_at,
    };

    const company: RawCompany = {
      name: companyName,
      website,
      description: description.substring(0, 500),
      location,
    };

    return { job, company };
  }
}
