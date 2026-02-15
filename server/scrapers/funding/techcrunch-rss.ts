import Parser from 'rss-parser';
import { BaseScraper, ScraperResult, RawCompany, RawFundingEvent, parseFundingStage, cleanText } from '../base.js';

interface FeedItem {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  creator?: string;
  categories?: string[];
}

// Patterns for matching funding headlines:
// "X raises $YM in Series Z"
// "X lands $Y million Series Z"
// "X nabs $Y million in seed funding"
// "X gets $YM Series Z led by Investor"
const FUNDING_PATTERNS = [
  /^(.+?)\s+raises?\s+\$?([\d,.]+)\s*(million|billion|[mbMB])?\s*(?:in\s+)?(?:a\s+)?((?:pre-?)?seed|series\s*[a-z]|growth|bridge|debt|extension)/i,
  /^(.+?)\s+(?:lands?|nabs?|secures?|closes?|gets?|grabs?|bags?)\s+\$?([\d,.]+)\s*(million|billion|[mbMB])?\s*(?:in\s+)?(?:a\s+)?((?:pre-?)?seed|series\s*[a-z]|growth|bridge|debt|extension)/i,
  /^(.+?)\s+(?:announces?|scores?)\s+\$?([\d,.]+)\s*(million|billion|[mbMB])?\s*(?:in\s+)?(?:a\s+)?((?:pre-?)?seed|series\s*[a-z]|growth|bridge|debt|extension)/i,
  // Reverse pattern: "Series Z: X raises $YM"
  /((?:pre-?)?seed|series\s*[a-z]):\s*(.+?)\s+raises?\s+\$?([\d,.]+)\s*(million|billion|[mbMB])?/i,
];

// Pattern to extract investors: "led by X" or "from X and Y"
const INVESTOR_PATTERNS = [
  /led by\s+(.+?)(?:\.|,\s*(?:with|and|at)|\band\b(?:\s+others)?$)/i,
  /(?:from|backed by|investors? include)\s+(.+?)(?:\.|$)/i,
  /participation (?:from|by)\s+(.+?)(?:\.|$)/i,
];

export default class TechCrunchRssScraper extends BaseScraper {
  name = 'techcrunch-rss';

  private parser: Parser;

  private feedUrls = [
    'https://techcrunch.com/tag/funding/feed/',
    'https://techcrunch.com/category/startups/feed/',
  ];

  constructor() {
    super();
    this.parser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StartupEvalBot/1.0)',
      },
    });
  }

  async scrape(): Promise<ScraperResult> {
    const fundingEvents: RawFundingEvent[] = [];
    const companies: RawCompany[] = [];
    const seenCompanies = new Set<string>();
    const seenUrls = new Set<string>();

    for (const feedUrl of this.feedUrls) {
      try {
        this.log(`Parsing RSS feed: ${feedUrl}`);
        const feed = await this.parser.parseURL(feedUrl);

        if (!feed.items || feed.items.length === 0) {
          this.log(`No items in feed: ${feedUrl}`);
          continue;
        }

        this.log(`Found ${feed.items.length} items in feed`);

        for (const item of feed.items) {
          if (!item.title || !item.link) continue;
          if (seenUrls.has(item.link)) continue;
          seenUrls.add(item.link);

          const parsed = this.parseFundingArticle(item as FeedItem);
          if (!parsed) continue;

          fundingEvents.push(parsed.event);

          const companyKey = parsed.event.company_name.toLowerCase();
          if (!seenCompanies.has(companyKey)) {
            seenCompanies.add(companyKey);
            companies.push(parsed.company);
          }
        }

        await this.delay(500);
      } catch (err) {
        this.logError(`Failed to parse feed: ${feedUrl}`, err);
      }
    }

    this.log(`Scrape complete: ${fundingEvents.length} funding events, ${companies.length} companies`);
    return { jobs: [], companies, fundingEvents };
  }

  private parseFundingArticle(item: FeedItem): { event: RawFundingEvent; company: RawCompany } | null {
    const title = item.title || '';
    const description = cleanText(item.contentSnippet || item.content || '');
    const fullText = title + ' ' + description;

    // Try each funding pattern
    let companyName: string | undefined;
    let amountStr: string | undefined;
    let amountUnit: string | undefined;
    let roundType: string | undefined;

    for (const pattern of FUNDING_PATTERNS) {
      const match = title.match(pattern);
      if (!match) continue;

      // Handle the reverse pattern (Series Z: Company raises $X)
      if (pattern === FUNDING_PATTERNS[3]) {
        roundType = match[1];
        companyName = match[2].trim();
        amountStr = match[3];
        amountUnit = match[4];
      } else {
        companyName = match[1].trim();
        amountStr = match[2];
        amountUnit = match[3];
        roundType = match[4];
      }
      break;
    }

    if (!companyName || !roundType) return null;

    // Clean the company name
    companyName = companyName
      .replace(/^(startup\s+|company\s+)/i, '')
      .replace(/['']s$/i, '')
      .trim();

    if (companyName.length < 2 || companyName.length > 80) return null;

    // Format amount
    const amount = this.formatAmount(amountStr, amountUnit);

    // Extract investors
    const investors = this.extractInvestors(fullText);

    // Normalize round type
    const normalizedRound = parseFundingStage(roundType) || roundType;

    const event: RawFundingEvent = {
      company_name: companyName,
      round_type: normalizedRound,
      amount: amount || undefined,
      date: item.pubDate || undefined,
      investors: investors.length > 0 ? investors : undefined,
      source_url: item.link || undefined,
    };

    const company: RawCompany = {
      name: companyName,
      funding_stage: normalizedRound,
      total_raised: amount || undefined,
      last_funding_date: item.pubDate || undefined,
      investors: investors.length > 0 ? investors : undefined,
      description: description.substring(0, 500) || undefined,
    };

    return { event, company };
  }

  private formatAmount(amountStr?: string, unit?: string): string | undefined {
    if (!amountStr) return undefined;

    const num = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(num)) return undefined;

    const normalizedUnit = (unit || '').toLowerCase();

    if (normalizedUnit === 'billion' || normalizedUnit === 'b') {
      return `$${num}B`;
    }
    if (normalizedUnit === 'million' || normalizedUnit === 'm' || !normalizedUnit) {
      // If no unit and number is large, assume it's already in the right unit
      if (!normalizedUnit && num > 1000) {
        return `$${num}`;
      }
      return `$${num}M`;
    }
    return `$${amountStr}`;
  }

  private extractInvestors(text: string): string[] {
    const investors: string[] = [];

    for (const pattern of INVESTOR_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        const investorStr = match[1];
        // Split on commas and "and"
        const parts = investorStr
          .split(/,\s*|\s+and\s+/)
          .map(s => s.trim())
          .filter(s => s.length > 1 && s.length < 60)
          // Filter out non-investor phrases
          .filter(s => !/^(others|more|several|various|a\s|the\s|its\s)/i.test(s));

        investors.push(...parts);
        break; // Use the first matching pattern
      }
    }

    return investors;
  }
}
