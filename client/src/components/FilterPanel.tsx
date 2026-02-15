import { useState } from 'react';
import { ChevronDown, ChevronUp, X, Search } from 'lucide-react';
import { Button } from './ui/button';
import type { JobSearchParams, FilterOptions } from '../types';

interface FilterPanelProps {
  filters: JobSearchParams;
  filterOptions: FilterOptions | null;
  onChange: (updates: Partial<JobSearchParams>) => void;
  onClear?: () => void;
}

export default function FilterPanel({ filters, filterOptions, onChange, onClear: _onClear }: FilterPanelProps) {
  const [vcSearch, setVcSearch] = useState('');
  const [showAllVcs, setShowAllVcs] = useState(false);

  if (!filterOptions) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  const selectedVcs = filters.vc ? filters.vc.split(',') : [];
  const selectedFundingStages = filters.funding_stage ? filters.funding_stage.split(',') : [];

  const vcNames = filterOptions.vcs.map((v: any) => typeof v === 'string' ? v : v.name);
  const filteredVcs = vcNames.filter((vc: string) =>
    vc.toLowerCase().includes(vcSearch.toLowerCase())
  );
  const displayedVcs = showAllVcs ? filteredVcs : filteredVcs.slice(0, 10);

  const toggleFundingStage = (stage: string) => {
    const current = new Set(selectedFundingStages);
    if (current.has(stage)) {
      current.delete(stage);
    } else {
      current.add(stage);
    }
    const val = Array.from(current).join(',');
    onChange({ funding_stage: val || undefined, page: 1 });
  };

  const toggleVc = (vc: string) => {
    const current = new Set(selectedVcs);
    if (current.has(vc)) {
      current.delete(vc);
    } else {
      current.add(vc);
    }
    const val = Array.from(current).join(',');
    onChange({ vc: val || undefined, page: 1 });
  };

  const companySizeOptions = [
    { label: 'Any', value: undefined },
    { label: '1-10', value: '1-10' },
    { label: '11-50', value: '11-50' },
    { label: '51-200', value: '51-200' },
    { label: '201-500', value: '201-500' },
    { label: '500+', value: '500+' },
  ];

  const postedWithinOptions = [
    { label: 'All time', value: undefined },
    { label: 'Last 24 hours', value: '24h' },
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
  ];

  const clearAll = () => {
    onChange({
      funding_stage: undefined,
      vc: undefined,
      company_size: undefined,
      posted_within: undefined,
      location: undefined,
      remote: undefined,
      page: 1,
    });
    setVcSearch('');
  };

  const hasActiveFilters =
    filters.funding_stage ||
    filters.vc ||
    filters.company_size ||
    filters.posted_within ||
    filters.location ||
    filters.remote;

  return (
    <div className="space-y-6">
      {/* Funding Stage */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Funding Stage
        </h3>
        <div className="space-y-2">
          {filterOptions.funding_stages.map((stage) => (
            <label
              key={stage}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={selectedFundingStages.includes(stage)}
                onChange={() => toggleFundingStage(stage)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
              />
              <span className="text-sm text-gray-300 group-hover:text-gray-100 transition-colors">
                {stage}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* VCs */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          VC Portfolio
        </h3>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <input
            type="text"
            value={vcSearch}
            onChange={(e) => setVcSearch(e.target.value)}
            placeholder="Search VCs..."
            className="w-full h-8 pl-8 pr-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-300 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
          {displayedVcs.map((vc) => (
            <label
              key={vc}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={selectedVcs.includes(vc)}
                onChange={() => toggleVc(vc)}
                className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
              />
              <span className="text-sm text-gray-300 group-hover:text-gray-100 transition-colors truncate">
                {vc}
              </span>
            </label>
          ))}
        </div>
        {filteredVcs.length > 10 && (
          <button
            onClick={() => setShowAllVcs(!showAllVcs)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
          >
            {showAllVcs ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Show all {filteredVcs.length} <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </section>

      {/* Company Size */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Company Size
        </h3>
        <div className="space-y-2">
          {companySizeOptions.map((opt) => (
            <label
              key={opt.label}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="radio"
                name="company_size"
                checked={(filters.company_size ?? undefined) === opt.value}
                onChange={() => onChange({ company_size: opt.value, page: 1 })}
                className="border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
              />
              <span className="text-sm text-gray-300 group-hover:text-gray-100 transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Posted Within */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Posted Within
        </h3>
        <select
          value={filters.posted_within ?? ''}
          onChange={(e) =>
            onChange({ posted_within: e.target.value || undefined, page: 1 })
          }
          className="w-full h-9 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-300 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {postedWithinOptions.map((opt) => (
            <option key={opt.label} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      {/* Location */}
      <section>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Location
        </h3>
        <input
          type="text"
          value={filters.location ?? ''}
          onChange={(e) =>
            onChange({ location: e.target.value || undefined, page: 1 })
          }
          placeholder="e.g. San Francisco, NYC"
          className="w-full h-9 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-300 px-3 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </section>

      {/* Remote Only */}
      <section>
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            Remote Only
          </span>
          <button
            role="switch"
            aria-checked={!!filters.remote}
            onClick={() => onChange({ remote: filters.remote ? undefined : true, page: 1 })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              filters.remote ? 'bg-blue-500' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                filters.remote ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </section>

      {/* Clear All */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={clearAll}
          className="w-full border-gray-700 text-gray-400 hover:text-gray-100 hover:border-gray-500"
        >
          <X className="h-4 w-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
