import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_VERCEL = !!process.env.VERCEL;
const LOCAL_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DATA_DIR = IS_VERCEL ? '/tmp' : LOCAL_DIR;
const DB_FILE = path.join(DATA_DIR, 'store.json');
// On Vercel, bundled seed data lives relative to cwd (project root)
const BUNDLED_DB = path.join(process.cwd(), 'data', 'store.json');

// --- In-memory data store (JSON-backed, Vercel-compatible) ---

interface StoreData {
  companies: Record<number, CompanyRow>;
  jobs: Record<number, JobRow>;
  funding_events: Record<number, FundingEventRow>;
  scrape_logs: ScrapeLogRow[];
  nextCompanyId: number;
  nextJobId: number;
  nextFundingId: number;
  nextLogId: number;
}

export interface CompanyRow {
  id: number;
  name: string;
  website: string | null;
  description: string | null;
  funding_stage: string | null;
  total_raised: string | null;
  last_funding_date: string | null;
  headcount_min: number | null;
  headcount_max: number | null;
  location: string | null;
  investors: string; // JSON string
  founded_year: number | null;
  logo_url: string | null;
  industry: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface JobRow {
  id: number;
  company_id: number;
  title: string;
  normalized_title: string;
  description: string | null;
  location: string | null;
  remote_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  url: string;
  source: string;
  source_id: string | null;
  dedup_hash: string;
  posted_at: string | null;
  scraped_at: string;
  last_seen_at: string;
  is_active: number;
  merged_from: string; // JSON string
  created_at: string;
}

export interface FundingEventRow {
  id: number;
  company_id: number;
  round_type: string;
  amount: string | null;
  date: string | null;
  investors: string; // JSON string
  source_url: string | null;
  scraped_at: string;
}

export interface ScrapeLogRow {
  id: number;
  source: string;
  status: string;
  jobs_found: number;
  jobs_new: number;
  jobs_updated: number;
  jobs_deactivated: number;
  error_message: string | null;
  duration_ms: number;
  timestamp: string;
}

let store: StoreData | null = null;

function now(): string {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function loadStore(): StoreData {
  if (store) return store;

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {}

  // Try loading from the writable location first (e.g. /tmp on Vercel)
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      store = JSON.parse(raw);
      return store!;
    }
  } catch {}

  // On Vercel, fall back to the bundled seed data shipped with the deployment
  if (IS_VERCEL) {
    try {
      if (fs.existsSync(BUNDLED_DB)) {
        const raw = fs.readFileSync(BUNDLED_DB, 'utf-8');
        store = JSON.parse(raw);
        return store!;
      }
    } catch {}
  }

  store = {
    companies: {},
    jobs: {},
    funding_events: {},
    scrape_logs: [],
    nextCompanyId: 1,
    nextJobId: 1,
    nextFundingId: 1,
    nextLogId: 1,
  };
  return store;
}

function saveStore(): void {
  if (!store) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(store), 'utf-8');
  } catch {}
}

// --- Public API (drop-in replacement for schema.ts queries) ---

export function getStore(): StoreData {
  return loadStore();
}

// Company operations
export function findCompanyByName(name: string, website?: string | null): CompanyRow | undefined {
  const s = loadStore();
  const lowerName = name.toLowerCase();
  return Object.values(s.companies).find(c =>
    c.name.toLowerCase() === lowerName &&
    (website == null || c.website == null || c.website === website)
  );
}

export function insertCompany(data: Partial<CompanyRow>): number {
  const s = loadStore();
  const id = s.nextCompanyId++;
  s.companies[id] = {
    id,
    name: data.name || '',
    website: data.website || null,
    description: data.description || null,
    funding_stage: data.funding_stage || null,
    total_raised: data.total_raised || null,
    last_funding_date: data.last_funding_date || null,
    headcount_min: data.headcount_min || null,
    headcount_max: data.headcount_max || null,
    location: data.location || null,
    investors: data.investors || '[]',
    founded_year: data.founded_year || null,
    logo_url: data.logo_url || null,
    industry: data.industry || null,
    source: data.source || 'scraper',
    created_at: now(),
    updated_at: now(),
  };
  saveStore();
  return id;
}

export function updateCompany(id: number, data: Partial<CompanyRow>): void {
  const s = loadStore();
  const c = s.companies[id];
  if (!c) return;
  if (data.description) c.description = data.description;
  if (data.funding_stage) c.funding_stage = data.funding_stage;
  if (data.total_raised) c.total_raised = data.total_raised;
  if (data.last_funding_date) c.last_funding_date = data.last_funding_date;
  if (data.headcount_min) c.headcount_min = data.headcount_min;
  if (data.headcount_max) c.headcount_max = data.headcount_max;
  if (data.location) c.location = data.location;
  if (data.investors && data.investors !== '[]') c.investors = data.investors;
  if (data.founded_year) c.founded_year = data.founded_year;
  if (data.logo_url) c.logo_url = data.logo_url;
  if (data.industry) c.industry = data.industry;
  if (data.website) c.website = data.website;
  c.updated_at = now();
  saveStore();
}

// Job operations
export function findJobByHash(hash: string): JobRow | undefined {
  const s = loadStore();
  return Object.values(s.jobs).find(j => j.dedup_hash === hash && j.is_active === 1);
}

export function insertJob(data: Partial<JobRow>): number {
  const s = loadStore();
  const id = s.nextJobId++;
  s.jobs[id] = {
    id,
    company_id: data.company_id || 0,
    title: data.title || '',
    normalized_title: data.normalized_title || '',
    description: data.description || null,
    location: data.location || null,
    remote_type: data.remote_type || null,
    salary_min: data.salary_min || null,
    salary_max: data.salary_max || null,
    salary_currency: data.salary_currency || 'USD',
    url: data.url || '',
    source: data.source || '',
    source_id: data.source_id || null,
    dedup_hash: data.dedup_hash || '',
    posted_at: data.posted_at || null,
    scraped_at: now(),
    last_seen_at: now(),
    is_active: 1,
    merged_from: data.merged_from || '[]',
    created_at: now(),
  };
  saveStore();
  return id;
}

export function updateJob(id: number, data: Partial<JobRow>): void {
  const s = loadStore();
  const j = s.jobs[id];
  if (!j) return;
  Object.assign(j, data);
  saveStore();
}

// Funding events
export function findFundingEvent(companyId: number, roundType: string, date?: string | null): FundingEventRow | undefined {
  const s = loadStore();
  return Object.values(s.funding_events).find(fe =>
    fe.company_id === companyId && fe.round_type === roundType && (fe.date === date || !date)
  );
}

export function insertFundingEvent(data: Partial<FundingEventRow>): number {
  const s = loadStore();
  const id = s.nextFundingId++;
  s.funding_events[id] = {
    id,
    company_id: data.company_id || 0,
    round_type: data.round_type || '',
    amount: data.amount || null,
    date: data.date || null,
    investors: data.investors || '[]',
    source_url: data.source_url || null,
    scraped_at: now(),
  };
  saveStore();
  return id;
}

// Scrape logs
export function insertScrapeLog(data: Partial<ScrapeLogRow>): void {
  const s = loadStore();
  s.scrape_logs.push({
    id: s.nextLogId++,
    source: data.source || '',
    status: data.status || 'success',
    jobs_found: data.jobs_found || 0,
    jobs_new: data.jobs_new || 0,
    jobs_updated: data.jobs_updated || 0,
    jobs_deactivated: data.jobs_deactivated || 0,
    error_message: data.error_message || null,
    duration_ms: data.duration_ms || 0,
    timestamp: now(),
  });
  // Keep only last 500 logs
  if (s.scrape_logs.length > 500) {
    s.scrape_logs = s.scrape_logs.slice(-500);
  }
  saveStore();
}

// --- Full-text search (simple implementation) ---
export function searchJobs(query: string): number[] {
  const s = loadStore();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: { id: number; score: number }[] = [];

  for (const job of Object.values(s.jobs)) {
    if (job.is_active !== 1) continue;
    const company = s.companies[job.company_id];
    const text = [
      job.title,
      job.description || '',
      company?.name || '',
      job.location || '',
    ].join(' ').toLowerCase();

    let score = 0;
    for (const term of terms) {
      if (text.includes(term)) score++;
      // Boost title matches
      if (job.title.toLowerCase().includes(term)) score += 2;
    }

    if (score > 0) {
      scored.push({ id: job.id, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.id);
}

// --- Query helpers ---
export function getActiveJobs(): JobRow[] {
  const s = loadStore();
  return Object.values(s.jobs).filter(j => j.is_active === 1);
}

export function getJobById(id: number): JobRow | undefined {
  return loadStore().jobs[id];
}

export function getCompanyById(id: number): CompanyRow | undefined {
  return loadStore().companies[id];
}

export function getAllCompanies(): CompanyRow[] {
  return Object.values(loadStore().companies);
}

export function getJobsByCompany(companyId: number): JobRow[] {
  const s = loadStore();
  return Object.values(s.jobs).filter(j => j.company_id === companyId && j.is_active === 1);
}

export function getFundingByCompany(companyId: number): FundingEventRow[] {
  const s = loadStore();
  return Object.values(s.funding_events).filter(fe => fe.company_id === companyId);
}

export function getScrapeLogsBySource(source?: string, limit = 50): ScrapeLogRow[] {
  const s = loadStore();
  let logs = s.scrape_logs;
  if (source) logs = logs.filter(l => l.source === source);
  return logs.slice(-limit).reverse();
}

export function getStats() {
  const s = loadStore();
  const activeJobs = Object.values(s.jobs).filter(j => j.is_active === 1);
  const companyIds = new Set(activeJobs.map(j => j.company_id));
  const sources = new Set(activeJobs.map(j => j.source));
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  return {
    total_active_jobs: activeJobs.length,
    total_companies: companyIds.size,
    sources_count: sources.size,
    last_updated: activeJobs.length > 0
      ? activeJobs.reduce((latest, j) => j.scraped_at > latest ? j.scraped_at : latest, '')
      : null,
    jobs_added_24h: activeJobs.filter(j => j.created_at > oneDayAgo).length,
    jobs_added_7d: activeJobs.filter(j => j.created_at > sevenDaysAgo).length,
  };
}

export function closeDb(): void {
  saveStore();
  store = null;
}
