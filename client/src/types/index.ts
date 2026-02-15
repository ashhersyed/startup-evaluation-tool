export interface Company {
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
  investors: string[];
  founded_year: number | null;
  logo_url: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: number;
  company_id: number;
  title: string;
  normalized_title: string;
  description: string | null;
  location: string | null;
  remote_type: 'remote' | 'hybrid' | 'onsite' | null;
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
  merged_from: string[] | null;
  created_at: string;
  // Joined fields
  company_name?: string;
  company_website?: string;
  company_logo?: string;
  company_funding_stage?: string;
  company_headcount_min?: number;
  company_headcount_max?: number;
  company_investors?: string[];
  company_location?: string;
  source_count?: number;
}

export interface FundingEvent {
  id: number;
  company_id: number;
  round_type: string;
  amount: string | null;
  date: string | null;
  investors: string[];
  source_url: string | null;
  scraped_at: string;
}

export interface ScrapeLog {
  id: number;
  source: string;
  status: 'success' | 'error' | 'partial';
  jobs_found: number;
  jobs_new: number;
  jobs_updated: number;
  jobs_deactivated: number;
  error_message: string | null;
  duration_ms: number;
  timestamp: string;
}

export interface JobSearchParams {
  q?: string;
  funding_stage?: string;
  vc?: string;
  company_size?: string;
  posted_within?: string;
  location?: string;
  remote?: boolean;
  source?: string;
  industry?: string;
  sort?: 'relevance' | 'date' | 'company_size';
  page?: number;
  limit?: number;
}

export interface JobSearchResult {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface FilterOptions {
  funding_stages: string[];
  vcs: { name: string; count: number }[];
  company_sizes: { label: string; min: number; max: number }[];
  locations: { name: string; count: number }[];
  sources: { name: string; count: number }[];
  industries: string[];
}

export interface Recommendation {
  company: Company;
  score: number;
  reasons: string[];
  active_jobs_count: number;
  recent_jobs: Job[];
}

export interface DashboardStats {
  total_active_jobs: number;
  total_companies: number;
  sources_count: number;
  last_updated: string;
  jobs_added_24h: number;
  jobs_added_7d: number;
}
