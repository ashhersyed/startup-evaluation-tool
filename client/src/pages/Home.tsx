import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { Rocket, Search, Layers, RefreshCw, GitMerge } from 'lucide-react';
import { Button } from '../components/ui/button';
import StatsBar from '../components/StatsBar';
import { useAuth } from '../hooks/useAuth';
import { getStats } from '../lib/api';
import type { DashboardStats } from '../types';

export default function Home() {
  const { isAuthenticated, login } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/jobs');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim());
      toast.success('Welcome! Redirecting...');
      navigate('/jobs');
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) return null;

  const features = [
    {
      icon: Search,
      title: '30+ Sources',
      description:
        'Aggregating job boards, company career pages, and VC portfolio sites into one unified search.',
    },
    {
      icon: Layers,
      title: '14 VC Portfolios',
      description:
        'Jobs from top portfolios including YC, a16z, Sequoia, Greylock, Benchmark, and more.',
    },
    {
      icon: RefreshCw,
      title: 'Real-time Freshness',
      description:
        'Continuous scraping ensures you see the newest opportunities within hours of posting.',
    },
    {
      icon: GitMerge,
      title: 'Smart Dedup',
      description:
        'Intelligent deduplication merges identical postings from multiple sources into one listing.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/5 pointer-events-none" />

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Rocket className="h-10 w-10 text-blue-500" />
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-gray-100 tracking-tight">
            Find Your Next{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
              Startup Job
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-lg mx-auto leading-relaxed">
            Search 30+ sources including YC, a16z, Sequoia, and 14 top VC
            portfolios. All in one place.
          </p>

          {/* Email Gate */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="flex-1 h-12 px-4 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-base"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Loading...
                </span>
              ) : (
                'Get Access'
              )}
            </Button>
          </form>

          <p className="text-gray-600 text-sm">Free access. We'll send you weekly startup job digests.</p>

          {/* Stats */}
          {stats && (
            <div className="pt-4">
              <StatsBar stats={stats} />
            </div>
          )}
        </div>

        {/* Feature Cards */}
        <div className="max-w-4xl w-full mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-5 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <feature.icon className="h-8 w-8 text-blue-500 mb-3" />
              <h3 className="text-sm font-semibold text-gray-200 mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* VC logos */}
        <div className="max-w-4xl w-full mt-16 text-center px-4">
          <p className="text-gray-600 text-xs uppercase tracking-wider mb-4">Sourcing from portfolios of</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {['a16z', 'Sequoia', 'Accel', 'Greylock', 'Kleiner Perkins', 'Lightspeed', 'Index Ventures', 'General Catalyst', 'Bessemer', 'NEA', 'Insight Partners', 'Khosla', 'Thrive Capital', 'Battery Ventures'].map((vc) => (
              <span key={vc} className="bg-gray-900 border border-gray-800 rounded-full px-3 py-1 text-xs text-gray-500">
                {vc}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-6 text-center text-xs text-gray-600">
        Startup Job Search Engine
      </footer>
    </div>
  );
}
