import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { SlidersHorizontal, X, ArrowUpDown, LogOut } from 'lucide-react';
import { Button } from '../components/ui/button';
import SearchBar from '../components/SearchBar';
import FilterPanel from '../components/FilterPanel';
import JobCard from '../components/JobCard';
import Pagination from '../components/Pagination';
import { useAuth } from '../hooks/useAuth';
import { useJobs } from '../hooks/useJobs';
import { useFilters } from '../hooks/useFilters';
import type { JobSearchParams } from '../types';

export default function Jobs() {
  const { isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const { filterOptions } = useFilters();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [params, setParams] = useState<JobSearchParams>({
    q: '',
    page: 1,
    limit: 20,
    sort: 'date',
  });

  const { jobs, total, page, totalPages, loading, error } = useJobs(params);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const updateParams = useCallback((updates: Partial<JobSearchParams>) => {
    setParams((prev) => ({ ...prev, ...updates }));
  }, []);

  if (!isAuthenticated) return null;

  // Collect active filter pills
  const activeFilters: { label: string; key: string; value: string }[] = [];
  if (params.funding_stage) {
    params.funding_stage.split(',').forEach((s) =>
      activeFilters.push({ label: s, key: 'funding_stage', value: s })
    );
  }
  if (params.vc) {
    params.vc.split(',').forEach((v) =>
      activeFilters.push({ label: v, key: 'vc', value: v })
    );
  }
  if (params.company_size) {
    activeFilters.push({
      label: `${params.company_size} employees`,
      key: 'company_size',
      value: params.company_size,
    });
  }
  if (params.posted_within) {
    const labels: Record<string, string> = {
      '24h': 'Last 24h',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
    };
    activeFilters.push({
      label: labels[params.posted_within] ?? params.posted_within,
      key: 'posted_within',
      value: params.posted_within,
    });
  }
  if (params.location) {
    activeFilters.push({
      label: params.location,
      key: 'location',
      value: params.location,
    });
  }
  if (params.remote) {
    activeFilters.push({ label: 'Remote only', key: 'remote', value: 'true' });
  }

  const removeFilter = (key: string, value: string) => {
    if (key === 'funding_stage') {
      const stages = (params.funding_stage ?? '')
        .split(',')
        .filter((s) => s !== value);
      updateParams({
        funding_stage: stages.length ? stages.join(',') : undefined,
        page: 1,
      });
    } else if (key === 'vc') {
      const vcs = (params.vc ?? '').split(',').filter((v) => v !== value);
      updateParams({ vc: vcs.length ? vcs.join(',') : undefined, page: 1 });
    } else if (key === 'company_size') {
      updateParams({ company_size: undefined, page: 1 });
    } else if (key === 'posted_within') {
      updateParams({ posted_within: undefined, page: 1 });
    } else if (key === 'location') {
      updateParams({ location: undefined, page: 1 });
    } else if (key === 'remote') {
      updateParams({ remote: undefined, page: 1 });
    }
  };

  const sortOptions: { label: string; value: JobSearchParams['sort'] }[] = [
    { label: 'Most Recent', value: 'date' },
    { label: 'Relevance', value: 'relevance' },
    { label: 'Company Size', value: 'company_size' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/jobs')}
              className="text-lg font-bold text-blue-500 hover:text-blue-400 transition-colors whitespace-nowrap"
            >
              StartupJobs
            </button>
            <div className="flex-1">
              <SearchBar
                value={params.q ?? ''}
                onChange={(q) => updateParams({ q, page: 1 })}
              />
            </div>
            <button
              onClick={() => navigate('/recommendations')}
              className="hidden sm:inline-flex text-sm text-gray-400 hover:text-gray-200 transition-colors whitespace-nowrap"
            >
              Top 10
            </button>
            <Button
              variant="ghost"
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="text-gray-500 hover:text-gray-300"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden border-gray-700 text-gray-400"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {/* Active Filter Pills */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {activeFilters.map((f, i) => (
                <span
                  key={`${f.key}-${f.value}-${i}`}
                  className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full"
                >
                  {f.label}
                  <button
                    onClick={() => removeFilter(f.key, f.value)}
                    className="hover:text-blue-200 transition-colors ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={() =>
                  updateParams({
                    funding_stage: undefined,
                    vc: undefined,
                    company_size: undefined,
                    posted_within: undefined,
                    location: undefined,
                    remote: undefined,
                    page: 1,
                  })
                }
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24">
              <FilterPanel
                filters={params}
                filterOptions={filterOptions}
                onChange={updateParams}
              />
            </div>
          </aside>

          {/* Mobile Filter Drawer */}
          {showMobileFilters && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                onClick={() => setShowMobileFilters(false)}
              />
              <aside className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-gray-950 border-r border-gray-800 p-6 overflow-y-auto lg:hidden">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-200">
                    Filters
                  </h2>
                  <button
                    onClick={() => setShowMobileFilters(false)}
                    className="text-gray-400 hover:text-gray-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <FilterPanel
                  filters={params}
                  filterOptions={filterOptions}
                  onChange={updateParams}
                />
              </aside>
            </>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Result count + sort */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {loading ? (
                  'Searching...'
                ) : (
                  <>
                    <span className="text-gray-300 font-medium">
                      {total.toLocaleString()}
                    </span>{' '}
                    jobs found
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-gray-500" />
                <select
                  value={params.sort ?? 'date'}
                  onChange={(e) =>
                    updateParams({
                      sort: e.target.value as JobSearchParams['sort'],
                      page: 1,
                    })
                  }
                  className="bg-transparent text-sm text-gray-400 border-none focus:outline-none focus:ring-0 cursor-pointer"
                >
                  {sortOptions.map((opt) => (
                    <option
                      key={opt.value}
                      value={opt.value}
                      className="bg-gray-900"
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                {error}
              </div>
            )}

            {/* Job List */}
            <div className="space-y-3">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-5 rounded-xl bg-gray-900 border border-gray-800 animate-pulse"
                    >
                      <div className="h-5 w-2/3 bg-gray-800 rounded mb-3" />
                      <div className="h-4 w-1/3 bg-gray-800 rounded mb-3" />
                      <div className="flex gap-2">
                        <div className="h-6 w-20 bg-gray-800 rounded-full" />
                        <div className="h-6 w-16 bg-gray-800 rounded-full" />
                        <div className="h-6 w-24 bg-gray-800 rounded-full" />
                      </div>
                    </div>
                  ))
                : jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    />
                  ))}

              {!loading && jobs.length === 0 && !error && (
                <div className="text-center py-16">
                  <p className="text-gray-500 text-lg">No jobs found</p>
                  <p className="text-gray-600 text-sm mt-2">
                    Try adjusting your search or filters
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={(p) => {
                    updateParams({ page: p });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
