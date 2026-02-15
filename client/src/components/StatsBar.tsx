import { Briefcase, Building2, Globe, Clock } from 'lucide-react';
import type { DashboardStats } from '../types';

interface StatsBarProps {
  stats: DashboardStats;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

export default function StatsBar({ stats }: StatsBarProps) {
  const items = [
    {
      icon: Briefcase,
      label: 'Active Jobs',
      value: stats.total_active_jobs.toLocaleString(),
    },
    {
      icon: Building2,
      label: 'Companies',
      value: stats.total_companies.toLocaleString(),
    },
    {
      icon: Globe,
      label: 'Sources',
      value: stats.sources_count.toString(),
    },
    {
      icon: Clock,
      label: 'Last Updated',
      value: stats.last_updated ? formatDate(stats.last_updated) : 'N/A',
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 py-3 px-4 rounded-lg bg-gray-900/50 border border-gray-800/50">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <item.icon className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-gray-500">{item.label}:</span>
          <span className="text-sm font-medium text-gray-300">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
