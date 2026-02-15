import axios from 'axios';
import type {
  JobSearchParams,
  JobSearchResult,
  Job,
  FilterOptions,
  Recommendation,
  DashboardStats,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
  const { data } = await api.get<JobSearchResult>('/jobs', { params });
  return data;
}

export async function getJob(id: number): Promise<{ job: Job; related_jobs: any[] }> {
  const { data } = await api.get<{ job: Job; related_jobs: any[] }>(`/jobs/${id}`);
  return data;
}

export async function getFilters(): Promise<FilterOptions> {
  const { data } = await api.get<FilterOptions>('/filters');
  return data;
}

export async function getRecommendations(
  params: Record<string, string | undefined> = {}
): Promise<{ recommendations: Recommendation[] }> {
  const { data } = await api.get<{ recommendations: Recommendation[] }>('/recommend', { params });
  return data;
}

export async function getStats(): Promise<DashboardStats> {
  const { data } = await api.get<DashboardStats>('/stats');
  return data;
}

export async function subscribe(email: string): Promise<{ success: boolean }> {
  const { data } = await api.post<{ success: boolean }>('/subscribe', { email });
  return data;
}

export default api;
