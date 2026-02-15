import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../hooks/useAuth';
import { useJobs } from '../hooks/useJobs';
import { useFilters } from '../hooks/useFilters';
import { useDebounce } from '../hooks/useDebounce';
import { getStats } from '../lib/api';
import SearchBar from '../components/SearchBar';
import FilterPanel from '../components/FilterPanel';
import JobCard from '../components/JobCard';
import Pagination from '../components/Pagination';
import StatsBar from '../components/StatsBar';
import { Button } from '../components/ui/button';
import { Briefcase, SlidersHorizontal, X, Trophy, LogOut } from 'lucide-react';
import type { JobSearchParams, DashboardStats } from '../types';

export default function Jobs() {
  const { isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [params, setParams] = useState<JobSearchParams>({
    page: 1,
    limit: 20,
    sort: 'date',
  });

  // Sync debounced query into params
  useEffect(() => {
    setParams(p => ({ ...p, q: debouncedQuery || undefined, page: 1 }));
  }, [debouncedQuery]);

  const { jobs, total, page, totalPages, loading } = useJobs(params);
  const { filterOptions } = useFilters();

  useEffect(() => {
    if (!isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  const updateFilters = useCallback((updates: Partial<JobSearchParams>) => {
    setParams(p => ({ ...p, ...updates, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setParams({ page: 1, limit: 20, sort: 'date' });
  }, []);

  // Active filter pills
  const activeFilters: { key: string; label: string }[] = [];
  if (params.funding_stage) activeFilters.push({ key: 'funding_stage', label: `Stage: ${params.funding_stage}` });
  if (params.vc) activeFilters.push({ key: 'vc', label: `VC: ${params.vc}` });
  if (params.company_size) activeFilters.push({ key: 'company_size', label: `Size: ${params.company_size}` });
  if (params.posted_within) activeFilters.push({ key: 'posted_within', label: `Posted: ${params.posted_within}` });
  if (params.location) activeFilters.push({ key: 'location', label: `Location: ${params.location}` });
  if (params.remote) activeFilters.push({ key: 'remote', label: 'Remote Only' });

  const removeFilter = (key: string) => {
    const updates: any = { [key]: undefined };
    if (key === 'remote') updates.remote = false;
    updateFilters(updates);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white font-semibold">
            <Briefcase className="w-5 h-5 text-blue-500" />
            Startup Job Engine
          </button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/recommendations')} className="text-gray-400 hover:text-white">
              <Trophy className="w-4 h-4 mr-1" /> Top 10
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} className="text-gray-400 hover:text-white">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search bar */}
        <div className="mb-4">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Active filters + sort */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800 lg:hidden"
            >
              <SlidersHorizontal className="w-4 h-4 mr-1" />
              Filters
            </Button>
            {activeFilters.map(f => (
              <span key={f.key} className="inline-flex items-center gap-1 bg-blue-600/20 text-blue-400 text-xs px-3 py-1 rounded-full border border-blue-500/30">
                {f.label}
                <button onClick={() => removeFilter(f.key)} className="hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {activeFilters.length > 0 && (
              <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-300">
                Clear all
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span>{total.toLocaleString()} jobs</span>
            <select
              value={params.sort}
              onChange={(e) => updateFilters({ sort: e.target.value as any })}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-300 text-sm"
            >
              <option value="date">Newest</option>
              <option value="relevance">Relevance</option>
              <option value="company_size">Company Size</option>
            </select>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Filter sidebar - desktop */}
          <aside className={`w-72 shrink-0 ${showFilters ? 'block' : 'hidden'} lg:block`}>
            <div className="sticky top-20">
              <FilterPanel
                filters={params}
                filterOptions={filterOptions}
                onChange={updateFilters}
                onClear={clearFilters}
              />
            </div>
          </aside>

          {/* Job list */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
                    <div className="h-5 bg-gray-800 rounded w-3/4 mb-3" />
                    <div className="h-4 bg-gray-800 rounded w-1/2 mb-2" />
                    <div className="flex gap-2">
                      <div className="h-6 bg-gray-800 rounded-full w-20" />
                      <div className="h-6 bg-gray-800 rounded-full w-16" />
                    </div>
                  </div>
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-20">
                <Briefcase className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No jobs found</p>
                <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters</p>
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 border-gray-700 text-gray-300">
                  Clear Filters
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {jobs.map(job => (
                    <JobCard key={job.id} job={job} onClick={() => navigate(`/jobs/${job.id}`)} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={(p) => setParams(prev => ({ ...prev, page: p }))}
                    />
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-8">
            <StatsBar stats={stats} />
          </div>
        )}
      </div>
    </div>
  );
}
