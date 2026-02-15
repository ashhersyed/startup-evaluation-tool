import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../hooks/useAuth';
import { getRecommendations } from '../lib/api';
import {
  ArrowLeft, Trophy, ChevronDown, ChevronUp,
  MapPin, Globe, ExternalLink
} from 'lucide-react';
import type { Recommendation } from '../types';

export default function Recommendations() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const [fundingStage, setFundingStage] = useState('');
  const [vc, setVc] = useState('');
  const [remote, setRemote] = useState(false);
  const [companySize, setCompanySize] = useState('');

  useEffect(() => {
    if (!isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setLoading(true);
    const params: any = {};
    if (fundingStage) params.funding_stage = fundingStage;
    if (vc) params.vc = vc;
    if (remote) params.remote = 'true';
    if (companySize) params.company_size = companySize;

    getRecommendations(params)
      .then(data => setRecommendations(data.recommendations || []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoading(false));
  }, [fundingStage, vc, remote, companySize]);

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate('/jobs')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Jobs
          </button>
          <div className="flex items-center gap-2 text-white font-semibold">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Top 10 Hiring Companies
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-3 mb-8">
          <select
            value={fundingStage}
            onChange={(e) => setFundingStage(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            <option value="">All Stages</option>
            <option value="Pre-Seed">Pre-Seed</option>
            <option value="Seed">Seed</option>
            <option value="Series A">Series A</option>
            <option value="Series B">Series B</option>
            <option value="Series C">Series C</option>
            <option value="Series D">Series D</option>
          </select>

          <input
            type="text"
            placeholder="Filter by VC..."
            value={vc}
            onChange={(e) => setVc(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder:text-gray-600 w-40"
          />

          <select
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
          >
            <option value="">All Sizes</option>
            <option value="1-10">1-10</option>
            <option value="11-50">11-50</option>
            <option value="51-200">51-200</option>
            <option value="201-500">201-500</option>
            <option value="500-100000">500+</option>
          </select>

          <label className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={remote}
              onChange={(e) => setRemote(e.target.checked)}
              className="rounded border-gray-600"
            />
            Remote
          </label>
        </div>

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-gray-800 rounded-full" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-800 rounded w-1/3 mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No recommendations found</p>
            <p className="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div
                key={rec.company.id}
                className="bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Rank */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                      {index + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{rec.company.name}</h3>
                          {rec.company.description && (
                            <p className="text-gray-400 text-sm mt-1 line-clamp-2">{rec.company.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded font-medium">
                            Score: {rec.score}
                          </span>
                          <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
                            {rec.active_jobs_count} jobs
                          </span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        {rec.company.funding_stage && (
                          <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">
                            {rec.company.funding_stage}
                          </span>
                        )}
                        {rec.company.location && (
                          <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {rec.company.location}
                          </span>
                        )}
                        {rec.company.investors && rec.company.investors.length > 0 && (
                          <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full">
                            {rec.company.investors.slice(0, 2).join(', ')}{rec.company.investors.length > 2 ? ` +${rec.company.investors.length - 2}` : ''}
                          </span>
                        )}
                      </div>

                      {/* Reasons */}
                      <ul className="mt-3 space-y-1">
                        {rec.reasons.map((reason, i) => (
                          <li key={i} className="text-gray-400 text-xs flex items-center gap-1.5">
                            <span className="text-green-500">+</span> {reason}
                          </li>
                        ))}
                      </ul>

                      {/* Expand/collapse jobs */}
                      <button
                        onClick={() => setExpandedId(expandedId === rec.company.id ? null : rec.company.id)}
                        className="mt-3 text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1"
                      >
                        {expandedId === rec.company.id ? (
                          <><ChevronUp className="w-3 h-3" /> Hide jobs</>
                        ) : (
                          <><ChevronDown className="w-3 h-3" /> View open roles</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded jobs */}
                {expandedId === rec.company.id && rec.recent_jobs && (
                  <div className="border-t border-gray-800 bg-gray-950/50 px-6 py-4">
                    <div className="space-y-2">
                      {rec.recent_jobs.map((job: any) => (
                        <button
                          key={job.id}
                          onClick={() => navigate(`/jobs/${job.id}`)}
                          className="w-full text-left flex items-center justify-between p-3 bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          <div>
                            <p className="text-sm text-white font-medium">{job.title}</p>
                            <div className="flex gap-2 mt-0.5 text-xs text-gray-500">
                              {job.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                              {job.remote_type === 'remote' && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Remote</span>}
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-gray-600" />
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => navigate(`/jobs?company=${rec.company.name}`)}
                      className="mt-3 text-sm text-blue-400 hover:text-blue-300"
                    >
                      View all {rec.active_jobs_count} jobs →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
