import { useState, useEffect } from 'react';
import { getFilters } from '../lib/api';
import type { FilterOptions } from '../types';

export function useFilters() {
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchFilters() {
      try {
        const data = await getFilters();
        if (!cancelled) {
          setFilterOptions(data);
        }
      } catch {
        // Filters are non-critical; silently fall back to null
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchFilters();

    return () => {
      cancelled = true;
    };
  }, []);

  return { filterOptions, loading };
}
