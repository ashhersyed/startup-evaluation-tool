import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import {
  findCompanyByName, insertCompany, updateCompany,
  findJobByHash, insertJob, updateJob,
  insertScrapeLog,
} from '../db/store.js';

export interface RawJob {
  title: string;
  company_name: string;
  description?: string;
  location?: string;
  remote_type?: 'remote' | 'hybrid' | 'onsite';
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  url: string;
  source: string;
  source_id?: string;
  posted_at?: string;
}

export interface RawCompany {
  name: string;
  website?: string;
  description?: string;
  funding_stage?: string;
  total_raised?: string;
  last_funding_date?: string;
  headcount_min?: number;
  headcount_max?: number;
  location?: string;
  investors?: string[];
  founded_year?: number;
  logo_url?: string;
  industry?: string;
}

export interface RawFundingEvent {
  company_name: string;
  round_type: string;
  amount?: string;
  date?: string;
  investors?: string[];
  source_url?: string;
}

export interface ScraperResult {
  jobs: RawJob[];
  companies: RawCompany[];
  fundingEvents?: RawFundingEvent[];
}

export abstract class BaseScraper {
  abstract name: string;
  protected http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
  }

  abstract scrape(): Promise<ScraperResult>;

  protected async fetchHtml(url: string): Promise<cheerio.CheerioAPI> {
    const { data } = await this.http.get(url);
    return cheerio.load(data);
  }

  protected async fetchJson<T = any>(url: string): Promise<T> {
    const { data } = await this.http.get<T>(url);
    return data;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }

  protected logError(message: string, error?: any): void {
    console.error(`[${this.name}] ERROR: ${message}`, error?.message || '');
  }
}

// --- Utility functions ---

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(sr\.?|senior|jr\.?|junior|lead|staff|principal|intern)\b/gi, '')
    .replace(/\s*[\(\[][^\)\]]*[\)\]]\s*/g, '') // remove parentheticals
    .replace(/\s*[-–—]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateDedupHash(companyName: string, title: string, location: string): string {
  const normalized = [
    companyName.toLowerCase().trim(),
    normalizeTitle(title),
    (location || 'unknown').toLowerCase().trim(),
  ].join('|');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function parseRemoteType(text: string): 'remote' | 'hybrid' | 'onsite' | undefined {
  const lower = (text || '').toLowerCase();
  if (/\bremote\b/.test(lower) && /\bhybrid\b/.test(lower)) return 'hybrid';
  if (/\bfully\s*remote\b|\bremote\s*(only|first|friendly)?\b/.test(lower)) return 'remote';
  if (/\bhybrid\b/.test(lower)) return 'hybrid';
  if (/\bon[\s-]?site\b|\bin[\s-]?office\b|\bin[\s-]?person\b/.test(lower)) return 'onsite';
  return undefined;
}

export function parseSalary(text: string): { min?: number; max?: number; currency?: string } {
  if (!text) return {};
  const match = text.match(/[\$€£]?\s*([\d,]+)\s*[kK]?\s*[-–—to]+\s*[\$€£]?\s*([\d,]+)\s*[kK]?/);
  if (!match) return {};

  let min = parseInt(match[1].replace(/,/g, ''));
  let max = parseInt(match[2].replace(/,/g, ''));

  // If numbers look like they're in thousands (e.g., 120-180)
  if (min < 1000) min *= 1000;
  if (max < 1000) max *= 1000;

  const currency = text.includes('€') ? 'EUR' : text.includes('£') ? 'GBP' : 'USD';
  return { min, max, currency };
}

export function parseFundingStage(text: string): string | undefined {
  const lower = (text || '').toLowerCase();
  if (/pre[\s-]?seed/.test(lower)) return 'Pre-Seed';
  if (/\bseed\b/.test(lower)) return 'Seed';
  if (/series\s*a\b/i.test(lower)) return 'Series A';
  if (/series\s*b\b/i.test(lower)) return 'Series B';
  if (/series\s*c\b/i.test(lower)) return 'Series C';
  if (/series\s*d\b/i.test(lower)) return 'Series D';
  if (/series\s*[e-z]\b/i.test(lower)) return 'Series E+';
  if (/\bipo\b|\bpublic\b/.test(lower)) return 'Public';
  if (/\bgrowth\b/.test(lower)) return 'Growth';
  return undefined;
}

export function parseCompanySize(text: string): { min?: number; max?: number } {
  const match = (text || '').match(/(\d+)\s*[-–—to]+\s*(\d+)/);
  if (match) return { min: parseInt(match[1]), max: parseInt(match[2]) };

  const single = (text || '').match(/(\d+)\+?\s*(employees|people|team)/i);
  if (single) {
    const n = parseInt(single[1]);
    return { min: n, max: n > 500 ? 10000 : n * 2 };
  }
  return {};
}

export function cleanText(text: string): string {
  return (text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Database persistence helpers ---

export function upsertCompany(company: RawCompany): number {
  const existing = findCompanyByName(company.name, company.website);

  if (existing) {
    updateCompany(existing.id, {
      description: company.description || undefined,
      funding_stage: company.funding_stage || undefined,
      total_raised: company.total_raised || undefined,
      last_funding_date: company.last_funding_date || undefined,
      headcount_min: company.headcount_min || undefined,
      headcount_max: company.headcount_max || undefined,
      location: company.location || undefined,
      investors: (company.investors && company.investors.length > 0) ? JSON.stringify(company.investors) : undefined,
      founded_year: company.founded_year || undefined,
      logo_url: company.logo_url || undefined,
      industry: company.industry || undefined,
      website: company.website || undefined,
    } as any);
    return existing.id;
  }

  return insertCompany({
    name: company.name,
    website: company.website || null,
    description: company.description || null,
    funding_stage: company.funding_stage || null,
    total_raised: company.total_raised || null,
    last_funding_date: company.last_funding_date || null,
    headcount_min: company.headcount_min || null,
    headcount_max: company.headcount_max || null,
    location: company.location || null,
    investors: JSON.stringify(company.investors || []),
    founded_year: company.founded_year || null,
    logo_url: company.logo_url || null,
    industry: company.industry || null,
    source: 'scraper',
  });
}

export function upsertJob(job: RawJob, companyId: number): { isNew: boolean; jobId: number } {
  const hash = generateDedupHash(job.company_name, job.title, job.location || '');
  const normalized = normalizeTitle(job.title);

  const existing = findJobByHash(hash);

  if (existing) {
    if (existing.source !== job.source) {
      const mergedFrom = JSON.parse(existing.merged_from || '[]') as string[];
      if (!mergedFrom.includes(job.url)) {
        mergedFrom.push(job.url);
        updateJob(existing.id, {
          merged_from: JSON.stringify(mergedFrom),
          last_seen_at: new Date().toISOString(),
        });
      }
    } else {
      updateJob(existing.id, { last_seen_at: new Date().toISOString() });
    }
    return { isNew: false, jobId: existing.id };
  }

  const jobId = insertJob({
    company_id: companyId,
    title: job.title,
    normalized_title: normalized,
    description: job.description || null,
    location: job.location || null,
    remote_type: job.remote_type || null,
    salary_min: job.salary_min || null,
    salary_max: job.salary_max || null,
    salary_currency: job.salary_currency || 'USD',
    url: job.url,
    source: job.source,
    source_id: job.source_id || null,
    dedup_hash: hash,
    posted_at: job.posted_at || null,
  });

  return { isNew: true, jobId };
}

export function logScrape(
  source: string,
  status: 'success' | 'error' | 'partial',
  stats: { jobs_found?: number; jobs_new?: number; jobs_updated?: number; jobs_deactivated?: number; error_message?: string; duration_ms?: number }
): void {
  insertScrapeLog({
    source,
    status,
    jobs_found: stats.jobs_found || 0,
    jobs_new: stats.jobs_new || 0,
    jobs_updated: stats.jobs_updated || 0,
    jobs_deactivated: stats.jobs_deactivated || 0,
    error_message: stats.error_message || null,
    duration_ms: stats.duration_ms || 0,
  });
}
