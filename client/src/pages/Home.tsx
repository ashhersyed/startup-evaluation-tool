import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import {
  ArrowRight,
  Globe,
  Mail,
  Search,
  FileBarChart,
  Zap,
  Target,
  Filter,
  Briefcase,
  X as XIcon,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocation } from 'wouter'

type Role = 'founder' | 'investor'

const copy = {
  founder: {
    badge: 'For Founders',
    headline: 'See How Investors',
    headlineAccent: 'Evaluate You',
    sub: 'Understand the signals your website sends to VCs — and what to fix before your next raise.',
    cta: 'Analyze My Company',
    valueCards: [
      {
        icon: Target,
        title: 'Investor Lens Audit',
        desc: 'See exactly what signals investors pick up from your website — market fit, team credibility, and business model clarity.',
      },
      {
        icon: Zap,
        title: 'Actionable Improvements',
        desc: 'Get specific, practical suggestions on what to fix before your next pitch or fundraise.',
      },
    ],
  },
  investor: {
    badge: 'For Investors',
    headline: 'Screen Any Startup',
    headlineAccent: 'In Seconds',
    sub: 'Get a standardized scorecard on any company before committing to deeper due diligence.',
    cta: 'Evaluate a Startup',
    valueCards: [
      {
        icon: Filter,
        title: 'Top-of-Funnel Screening',
        desc: 'Quickly assess a startup\'s online maturity, positioning, and market signals before investing time in research.',
      },
      {
        icon: Briefcase,
        title: 'Standardized Framework',
        desc: 'Compare startups across the same 6 VC dimensions. Consistent, structured evaluation for every deal.',
      },
    ],
  },
}

const exampleScores = [
  {
    score: 85,
    label: 'High Score',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/30',
    founder: 'You\'re investor-ready. Strong signals across the board — start Series conversations.',
    investor: 'Investment-grade. Proceed with due diligence and request financials.',
  },
  {
    score: 65,
    label: 'Mid Score',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/30',
    founder: 'Strong potential. Add team bios, pricing, and customer proof to level up.',
    investor: 'Worth a founder meeting. Request metrics and schedule a deeper dive.',
  },
  {
    score: 35,
    label: 'Early Stage',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    founder: 'You\'re early. Focus on product and customers first — revisit fundraising later.',
    investor: 'Pre-institutional. Only consider if you\'re backing the team at the earliest stage.',
  },
]

const methodologyData = [
  { name: 'Market Opportunity', weight: '20%', question: 'How large and growing is the addressable market?', signals: 'Tech indicators, growth messaging, enterprise focus, careers page, customer traction.', example: 'Keywords like "AI", "enterprise", a careers page, and customer numbers score higher.' },
  { name: 'Product-Market Fit', weight: '20%', question: 'Is there evidence the product solves a real problem?', signals: 'Social proof, testimonials, customer metrics, pricing page, clear CTAs, integrations.', example: '"Trusted by 500+ companies" with a pricing page and API docs signals strong fit.' },
  { name: 'Team Quality', weight: '20%', question: 'Does the team appear credible and capable?', signals: 'Team/about page, careers page, LinkedIn presence, social channels, investor backing.', example: 'Founder bios, LinkedIn links, "YC-backed" mention, and open job listings.' },
  { name: 'Business Model', weight: '15%', question: 'Is there a clear path to revenue?', signals: 'Pricing page, revenue indicators, freemium/trial, enterprise sales, subscriptions.', example: 'Visible pricing tiers with monthly/annual options and "Contact Sales".' },
  { name: 'Competitive Advantage', weight: '15%', question: 'What makes this startup defensible?', signals: 'Tech moat, proprietary/patent mentions, unique positioning, integration ecosystem.', example: '"Proprietary AI" with deep API docs and funded status signals a moat.' },
  { name: 'Execution Capability', weight: '10%', question: 'How well does the team ship and operate?', signals: 'SSL, SEO optimization, blog/content, careers, CTAs, multi-channel presence.', example: 'Well-structured site with SSL, meta tags, active blog, and social channels.' },
]

export default function Home() {
  const savedEmail = sessionStorage.getItem('eval_email') || ''
  const savedRole = (sessionStorage.getItem('eval_role') as Role) || null
  const [role, setRole] = useState<Role | null>(savedRole)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [email, setEmail] = useState(savedEmail)
  const [step, setStep] = useState<'url' | 'email'>('url')
  const [showMethodology, setShowMethodology] = useState(false)
  const [, navigate] = useLocation()

  const selectRole = (r: Role) => {
    setRole(r)
    sessionStorage.setItem('eval_role', r)
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!websiteUrl.trim()) {
      toast.error('Please enter a website URL')
      return
    }
    if (savedEmail) {
      sessionStorage.setItem('eval_url', websiteUrl.trim())
      toast.success('Analyzing startup...')
      navigate('/results')
      return
    }
    setStep('email')
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }
    sessionStorage.setItem('eval_url', websiteUrl.trim())
    sessionStorage.setItem('eval_email', email.trim())
    toast.success('Analyzing startup...')
    navigate('/results')
  }

  const c = role ? copy[role] : null

  return (
    <div className="min-h-screen bg-black">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="text-white font-bold text-lg">AngelsRound</span>
        <button
          onClick={() => setShowMethodology(true)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <Info className="w-4 h-4" />
          How It Works
        </button>
      </nav>

      {/* Methodology Modal */}
      {showMethodology && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowMethodology(false)}
          />
          <div className="relative bg-neutral-900 border border-neutral-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                How We Score Startups
              </h2>
              <button
                onClick={() => setShowMethodology(false)}
                className="text-gray-500 hover:text-white"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Our engine scans publicly available signals from a startup's
              website and scores across 6 dimensions commonly used by venture
              capital firms. Each dimension is weighted based on its importance
              in early-stage evaluation.
            </p>
            <div className="space-y-4">
              {methodologyData.map((dim) => (
                <div
                  key={dim.name}
                  className="border-b border-neutral-800 pb-4 last:border-0"
                >
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-white font-medium">{dim.name}</h4>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">
                      {dim.weight} weight
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mb-1">{dim.question}</p>
                  <p className="text-gray-600 text-xs">
                    <span className="text-gray-400">Signals:</span>{' '}
                    {dim.signals}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    <span className="text-gray-400">Example:</span>{' '}
                    {dim.example}
                  </p>
                </div>
              ))}
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-4 mt-6">
              <p className="text-gray-400 text-sm">
                <span className="text-white font-medium">Overall score:</span>{' '}
                Each category is scored 0–95 based on detected signals. The
                overall score is the weighted average across all 6 dimensions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative flex items-center justify-center px-4 pt-12 pb-16">
        <div className="max-w-2xl text-center">
          {/* Role selector — show if no role selected yet */}
          {!role ? (
            <div>
              <div className="inline-block mb-6 px-4 py-2 bg-[#E8723A]/15 border border-[#E8723A]/40 rounded-lg">
                <p className="text-sm font-semibold text-[#E8723A]">
                  Free Startup Scoring Tool
                </p>
              </div>

              <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
                Get a VC-Grade
                <br />
                <span className="text-[#E8723A]">Startup Scorecard</span>
              </h1>

              <p className="text-lg text-gray-400 mb-12 max-w-lg mx-auto">
                Instant evaluation across 6 key dimensions. Just paste a website
                URL and get your score.
              </p>

              <p className="text-sm text-gray-500 mb-6">I am a...</p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <button
                  onClick={() => selectRole('founder')}
                  className="flex-1 group relative bg-neutral-900 border-2 border-neutral-800 hover:border-[#E8723A] rounded-xl p-6 text-left transition-all"
                >
                  <Target className="w-8 h-8 text-[#E8723A] mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">Founder</h3>
                  <p className="text-sm text-gray-500">
                    See how investors evaluate your company
                  </p>
                </button>
                <button
                  onClick={() => selectRole('investor')}
                  className="flex-1 group relative bg-neutral-900 border-2 border-neutral-800 hover:border-[#E8723A] rounded-xl p-6 text-left transition-all"
                >
                  <Briefcase className="w-8 h-8 text-[#E8723A] mb-3" />
                  <h3 className="text-lg font-bold text-white mb-1">
                    Investor
                  </h3>
                  <p className="text-sm text-gray-500">
                    Screen startups before deeper research
                  </p>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Role badge + switcher */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="inline-block px-4 py-2 bg-[#E8723A]/15 border border-[#E8723A]/40 rounded-lg">
                  <p className="text-sm font-semibold text-[#E8723A]">
                    {c!.badge}
                  </p>
                </div>
                <button
                  onClick={() => selectRole(role === 'founder' ? 'investor' : 'founder')}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Switch to {role === 'founder' ? 'Investor' : 'Founder'} view
                </button>
              </div>

              <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
                {c!.headline}
                <br />
                <span className="text-[#E8723A]">{c!.headlineAccent}</span>
              </h1>

              <p className="text-lg text-gray-400 mb-10 max-w-lg mx-auto">
                {c!.sub}
              </p>

              {/* URL / Email input */}
              {step === 'url' ? (
                <form
                  onSubmit={handleUrlSubmit}
                  className="flex flex-col sm:flex-row gap-0 max-w-lg mx-auto mb-4 bg-white rounded-full overflow-hidden border-2 border-[#E8723A]/30"
                >
                  <div className="flex-1 relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. stripe.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 text-gray-800 bg-transparent outline-none text-base"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-[#E8723A] hover:bg-[#D4612E] text-white rounded-full px-6 m-1.5 font-semibold"
                  >
                    {c!.cta}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              ) : (
                <div className="max-w-lg mx-auto mb-4">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#E8723A] shrink-0" />
                    <span className="text-sm text-gray-300 truncate">
                      {websiteUrl}
                    </span>
                    <button
                      onClick={() => setStep('url')}
                      className="ml-auto text-xs text-[#E8723A] hover:text-[#F0844E]"
                    >
                      Change
                    </button>
                  </div>
                  <form
                    onSubmit={handleEmailSubmit}
                    className="flex flex-col sm:flex-row gap-0 bg-white rounded-full overflow-hidden border-2 border-[#E8723A]/30"
                  >
                    <div className="flex-1 relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-4 text-gray-800 bg-transparent outline-none text-base"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="bg-[#E8723A] hover:bg-[#D4612E] text-white rounded-full px-6 m-1.5 font-semibold"
                    >
                      Get Results
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                  <p className="text-xs text-gray-600 mt-3">
                    Free evaluation + weekly{' '}
                    {role === 'founder' ? 'founder' : 'investor'} insights.
                    Unsubscribe anytime.
                  </p>
                </div>
              )}

              <p className="text-xs text-gray-600 mt-2">
                Free. No credit card required.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Value cards — only show after role is selected */}
      {role && c && (
        <section className="px-4 pb-16">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {c.valueCards.map((card, i) => (
                <Card
                  key={i}
                  className="bg-neutral-900 border-neutral-800 p-6"
                >
                  <card.icon className="w-8 h-8 text-[#E8723A] mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {card.title}
                  </h3>
                  <p className="text-gray-500 text-sm">{card.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How It Works */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-lg font-semibold text-white text-center mb-8">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-[#E8723A]/15 border border-[#E8723A]/40 flex items-center justify-center mx-auto mb-4">
                <Search className="w-5 h-5 text-[#E8723A]" />
              </div>
              <h3 className="text-white font-medium mb-1">1. Paste a URL</h3>
              <p className="text-gray-500 text-sm">
                Enter any startup's website address
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-[#E8723A]/15 border border-[#E8723A]/40 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-5 h-5 text-[#E8723A]" />
              </div>
              <h3 className="text-white font-medium mb-1">
                2. Enter your email
              </h3>
              <p className="text-gray-500 text-sm">
                Unlock your free scorecard instantly
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-[#E8723A]/15 border border-[#E8723A]/40 flex items-center justify-center mx-auto mb-4">
                <FileBarChart className="w-5 h-5 text-[#E8723A]" />
              </div>
              <h3 className="text-white font-medium mb-1">
                3. Get your scorecard
              </h3>
              <p className="text-gray-500 text-sm">
                Scores across 6 VC dimensions with insights
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Example Scores */}
      <section className="px-4 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-lg font-semibold text-white text-center mb-2">
            What Your Score Means
          </h2>
          <p className="text-sm text-gray-500 text-center mb-8">
            The same score, interpreted for{' '}
            {role ? (role === 'founder' ? 'founders' : 'investors') : 'each audience'}
          </p>
          <div className="space-y-4">
            {exampleScores.map((ex) => (
              <div
                key={ex.score}
                className={`${ex.bg} border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4`}
              >
                <div className="shrink-0 text-center sm:text-left">
                  <p className={`text-3xl font-black ${ex.color}`}>
                    {ex.score}
                  </p>
                  <p className="text-xs text-gray-500">/100</p>
                </div>
                <div className="flex-1">
                  {(!role || role === 'founder') && (
                    <div className="mb-2 last:mb-0">
                      <span className="text-xs font-medium text-[#E8723A] uppercase tracking-wide">
                        Founder
                      </span>
                      <p className="text-sm text-gray-300">{ex.founder}</p>
                    </div>
                  )}
                  {(!role || role === 'investor') && (
                    <div>
                      <span className="text-xs font-medium text-[#E8723A] uppercase tracking-wide">
                        Investor
                      </span>
                      <p className="text-sm text-gray-300">{ex.investor}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
