import { MapPin, Clock, Building2, DollarSign, Globe2 } from 'lucide-react';
import type { Job } from '../types';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => {
    if (n >= 1000) return `$${Math.round(n / 1000)}k`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

interface JobCardProps {
  job: Job;
  onClick: () => void;
}

export default function JobCard({ job, onClick }: JobCardProps) {
  const salary = formatSalary(job.salary_min, job.salary_max);
  const posted = timeAgo(job.posted_at);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-500/40 hover:bg-gray-900/80 transition-all duration-200 group cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-100 group-hover:text-blue-400 transition-colors truncate">
            {job.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-sm text-gray-400 truncate">
              {job.company_name ?? 'Unknown Company'}
            </span>
          </div>
        </div>
        {posted && (
          <span className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0">
            <Clock className="h-3 w-3" />
            {posted}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        {job.location && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2.5 py-1 rounded-full">
            <MapPin className="h-3 w-3" />
            {job.location}
          </span>
        )}
        {job.remote_type && (
          <span
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
              job.remote_type === 'remote'
                ? 'bg-green-500/10 text-green-400'
                : job.remote_type === 'hybrid'
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            <Globe2 className="h-3 w-3" />
            {job.remote_type.charAt(0).toUpperCase() + job.remote_type.slice(1)}
          </span>
        )}
        {job.company_funding_stage && (
          <span className="inline-flex items-center text-xs text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">
            {job.company_funding_stage}
          </span>
        )}
        {salary && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
            <DollarSign className="h-3 w-3" />
            {salary}
          </span>
        )}
        {job.source && (
          <span className="inline-flex items-center text-xs text-gray-500 bg-gray-800/50 px-2.5 py-1 rounded-full">
            {job.source}
          </span>
        )}
        {job.source_count && job.source_count > 1 && (
          <span className="inline-flex items-center text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-full">
            {job.source_count} sources
          </span>
        )}
      </div>
    </button>
  );
}
