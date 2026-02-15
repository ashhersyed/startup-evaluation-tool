import crypto from 'crypto';
import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { getDb } from '../db/schema.js';

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
  const db = getDb();

  const existing = db.prepare(
    'SELECT id FROM companies WHERE LOWER(name) = LOWER(?) AND (website = ? OR website IS NULL OR ? IS NULL)'
  ).get(company.name, company.website, company.website) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE companies SET
        description = COALESCE(?, description),
        funding_stage = COALESCE(?, funding_stage),
        total_raised = COALESCE(?, total_raised),
        last_funding_date = COALESCE(?, last_funding_date),
        headcount_min = COALESCE(?, headcount_min),
        headcount_max = COALESCE(?, headcount_max),
        location = COALESCE(?, location),
        investors = CASE WHEN ? != '[]' THEN ? ELSE investors END,
        founded_year = COALESCE(?, founded_year),
        logo_url = COALESCE(?, logo_url),
        industry = COALESCE(?, industry),
        website = COALESCE(?, website),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      company.description, company.funding_stage, company.total_raised,
      company.last_funding_date, company.headcount_min, company.headcount_max,
      company.location,
      JSON.stringify(company.investors || []), JSON.stringify(company.investors || []),
      company.founded_year, company.logo_url, company.industry,
      company.website,
      existing.id
    );
    return existing.id;
  }

  const result = db.prepare(`
    INSERT INTO companies (name, website, description, funding_stage, total_raised,
      last_funding_date, headcount_min, headcount_max, location, investors,
      founded_year, logo_url, industry, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    company.name, company.website, company.description, company.funding_stage,
    company.total_raised, company.last_funding_date, company.headcount_min,
    company.headcount_max, company.location, JSON.stringify(company.investors || []),
    company.founded_year, company.logo_url, company.industry, 'scraper'
  );
  return Number(result.lastInsertRowid);
}

export function upsertJob(job: RawJob, companyId: number): { isNew: boolean; jobId: number } {
  const db = getDb();
  const hash = generateDedupHash(job.company_name, job.title, job.location || '');
  const normalized = normalizeTitle(job.title);

  const existing = db.prepare(
    'SELECT id, source, merged_from FROM jobs WHERE dedup_hash = ? AND is_active = 1'
  ).get(hash) as { id: number; source: string; merged_from: string } | undefined;

  if (existing) {
    // Merge sources if from different source
    if (existing.source !== job.source) {
      const mergedFrom = JSON.parse(existing.merged_from || '[]') as string[];
      if (!mergedFrom.includes(job.url)) {
        mergedFrom.push(job.url);
        db.prepare(
          'UPDATE jobs SET merged_from = ?, last_seen_at = datetime(\'now\') WHERE id = ?'
        ).run(JSON.stringify(mergedFrom), existing.id);
      }
    } else {
      db.prepare(
        'UPDATE jobs SET last_seen_at = datetime(\'now\') WHERE id = ?'
      ).run(existing.id);
    }
    return { isNew: false, jobId: existing.id };
  }

  const result = db.prepare(`
    INSERT INTO jobs (company_id, title, normalized_title, description, location,
      remote_type, salary_min, salary_max, salary_currency, url, source, source_id,
      dedup_hash, posted_at, is_active, merged_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '[]')
  `).run(
    companyId, job.title, normalized, job.description, job.location,
    job.remote_type, job.salary_min, job.salary_max, job.salary_currency || 'USD',
    job.url, job.source, job.source_id, hash, job.posted_at
  );

  const jobId = Number(result.lastInsertRowid);

  // Index in FTS
  db.prepare(
    'INSERT INTO jobs_fts(rowid, title, description, company_name, location) VALUES (?, ?, ?, ?, ?)'
  ).run(jobId, job.title, job.description || '', job.company_name, job.location || '');

  return { isNew: true, jobId };
}

export function logScrape(
  source: string,
  status: 'success' | 'error' | 'partial',
  stats: { jobs_found?: number; jobs_new?: number; jobs_updated?: number; jobs_deactivated?: number; error_message?: string; duration_ms?: number }
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO scrape_logs (source, status, jobs_found, jobs_new, jobs_updated, jobs_deactivated, error_message, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    source, status,
    stats.jobs_found || 0, stats.jobs_new || 0, stats.jobs_updated || 0,
    stats.jobs_deactivated || 0, stats.error_message || null, stats.duration_ms || 0
  );
}
