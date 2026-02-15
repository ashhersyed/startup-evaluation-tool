import { useState, useEffect } from 'react';
import { searchJobs } from '../lib/api';
import { useDebounce } from './useDebounce';
import type { Job, JobSearchParams } from '../types';

export function useJobs(params: JobSearchParams) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(params.q, 300);

  // Build the effective params with the debounced query value
  const effectiveParams: JobSearchParams = {
    ...params,
    q: debouncedQuery,
  };

  // Serialize params for use as a dependency (excluding the raw `q` which is debounced)
  const paramKey = JSON.stringify(effectiveParams);

  useEffect(() => {
    let cancelled = false;

    async function fetchJobs() {
      setLoading(true);
      setError(null);

      try {
        const result = await searchJobs(effectiveParams);

        if (!cancelled) {
          setJobs(result.jobs);
          setTotal(result.total);
          setPage(result.page);
          setTotalPages(result.total_pages);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch jobs');
          setJobs([]);
          setTotal(0);
          setTotalPages(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchJobs();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramKey]);

  return { jobs, total, page, totalPages, loading, error };
}
