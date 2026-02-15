import { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useAuth } from '../hooks/useAuth';
import { getJob } from '../lib/api';
import { Button } from '../components/ui/button';
import {
  ArrowLeft, ExternalLink, MapPin, Building2, DollarSign,
  Calendar, Globe, Users, Layers
} from 'lucide-react';
import type { Job } from '../types';

function timeAgo(date: string | null): string {
  if (!date) return 'Unknown';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function JobDetail() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [, routeParams] = useRoute('/jobs/:id');
  const [job, setJob] = useState<Job | null>(null);
  const [relatedJobs, setRelatedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!routeParams?.id) return;
    setLoading(true);
    getJob(parseInt(routeParams.id))
      .then(data => {
        setJob(data.job);
        setRelatedJobs(data.related_jobs || []);
      })
      .catch(() => setJob(null))
      .finally(() => setLoading(false));
  }, [routeParams?.id]);

  if (!isAuthenticated) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading job...</div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Job not found</p>
        <Button variant="outline" onClick={() => navigate('/jobs')} className="border-gray-700 text-gray-300">
          Back to Jobs
        </Button>
      </div>
    );
  }

  const mergedFrom = job.merged_from || [];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <button onClick={() => navigate('/jobs')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Jobs
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{job.title}</h1>
            <p className="text-lg text-blue-400 mb-4">{job.company_name}</p>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {job.location && (
                <span className="inline-flex items-center gap-1 bg-gray-800 text-gray-300 text-xs px-3 py-1.5 rounded-full">
                  <MapPin className="w-3 h-3" /> {job.location}
                </span>
              )}
              {job.remote_type && (
                <span className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full ${
                  job.remote_type === 'remote' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                  job.remote_type === 'hybrid' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                  'bg-gray-800 text-gray-300'
                }`}>
                  <Globe className="w-3 h-3" /> {job.remote_type.charAt(0).toUpperCase() + job.remote_type.slice(1)}
                </span>
              )}
              {job.company_funding_stage && (
                <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-400 text-xs px-3 py-1.5 rounded-full border border-purple-500/30">
                  <Layers className="w-3 h-3" /> {job.company_funding_stage}
                </span>
              )}
              {(job.salary_min || job.salary_max) && (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-full border border-emerald-500/30">
                  <DollarSign className="w-3 h-3" />
                  {job.salary_min ? `$${(job.salary_min / 1000).toFixed(0)}k` : ''}
                  {job.salary_min && job.salary_max ? ' - ' : ''}
                  {job.salary_max ? `$${(job.salary_max / 1000).toFixed(0)}k` : ''}
                </span>
              )}
              <span className="inline-flex items-center gap-1 bg-gray-800 text-gray-400 text-xs px-3 py-1.5 rounded-full">
                <Calendar className="w-3 h-3" /> {timeAgo(job.posted_at)}
              </span>
            </div>

            {/* Source info */}
            <div className="flex items-center gap-3 mb-6 text-sm">
              <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-xs">
                {job.source}
              </span>
              {mergedFrom.length > 0 && (
                <span className="text-gray-500 text-xs">
                  Found on {mergedFrom.length + 1} sources
                </span>
              )}
            </div>

            {/* Apply button */}
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-block mb-8">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                Apply <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>

            {/* Description */}
            {job.description && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Job Description</h2>
                <div
                  className="text-gray-300 text-sm leading-relaxed prose prose-invert max-w-none
                    [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white
                    [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
                    [&_a]:text-blue-400 [&_a:hover]:text-blue-300
                    [&_p]:mb-3 [&_li]:mb-1"
                  dangerouslySetInnerHTML={{ __html: job.description }}
                />
              </div>
            )}

            {/* Related jobs */}
            {relatedJobs.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-white mb-4">
                  More jobs at {job.company_name}
                </h2>
                <div className="space-y-2">
                  {relatedJobs.map((rj: any) => (
                    <button
                      key={rj.id}
                      onClick={() => navigate(`/jobs/${rj.id}`)}
                      className="w-full text-left bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                    >
                      <p className="text-white font-medium">{rj.title}</p>
                      <div className="flex gap-2 mt-1 text-xs text-gray-400">
                        {rj.location && <span>{rj.location}</span>}
                        {rj.remote_type && <span>({rj.remote_type})</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Company sidebar */}
          <aside className="w-full lg:w-72 shrink-0">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 sticky top-20">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                Company Info
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500">Company</p>
                  <p className="text-white font-medium">{job.company_name}</p>
                </div>

                {job.company_website && (
                  <div>
                    <p className="text-gray-500">Website</p>
                    <a href={job.company_website} target="_blank" rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm break-all">
                      {job.company_website.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}

                {job.company_funding_stage && (
                  <div>
                    <p className="text-gray-500">Funding Stage</p>
                    <p className="text-white">{job.company_funding_stage}</p>
                  </div>
                )}

                {(job.company_headcount_min || job.company_headcount_max) && (
                  <div>
                    <p className="text-gray-500">Team Size</p>
                    <p className="text-white flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {job.company_headcount_min}
                      {job.company_headcount_max ? `-${job.company_headcount_max}` : '+'} people
                    </p>
                  </div>
                )}

                {job.company_location && (
                  <div>
                    <p className="text-gray-500">Location</p>
                    <p className="text-white">{job.company_location}</p>
                  </div>
                )}

                {job.company_investors && job.company_investors.length > 0 && (
                  <div>
                    <p className="text-gray-500 mb-1">Investors</p>
                    <div className="flex flex-wrap gap-1">
                      {job.company_investors.map((inv: string) => (
                        <span key={inv} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">
                          {inv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
