import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import {
  ArrowRight,
  Globe,
  Mail,
  BarChart3,
  Share2,
  ChevronDown,
  ChevronUp,
  Info,
  Users,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocation } from 'wouter'

export default function Home() {
  const savedEmail = sessionStorage.getItem('eval_email') || ''
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [email, setEmail] = useState(savedEmail)
  const [step, setStep] = useState<'url' | 'email'>('url')
  const [showMethodology, setShowMethodology] = useState(false)
  const [, navigate] = useLocation()

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!websiteUrl.trim()) {
      toast.error('Please enter a website URL')
      return
    }
    // Skip email step if we already have one from a previous analysis
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

  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="relative flex items-center justify-center px-4 pt-20 pb-16">
        <div className="max-w-2xl text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-[#E8723A]/15 border border-[#E8723A]/40 rounded-lg">
            <p className="text-sm font-semibold text-[#E8723A]">
              Free Startup Scoring Tool
            </p>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            How Does Your Startup
            <br />
            <span className="text-[#E8723A]">Stack Up?</span>
          </h1>

          <p className="text-xl text-gray-400 mb-4 max-w-xl mx-auto">
            Whether you're a <span className="text-white font-medium">founder</span> looking to see how investors might view your company, or an <span className="text-white font-medium">investor</span> evaluating a potential deal — get an instant scorecard across 6 key VC dimensions.
          </p>

          <p className="text-sm text-gray-600 mb-10 max-w-md mx-auto">
            Just enter a website URL. Our engine scans public signals and scores the startup in seconds.
          </p>

          {step === 'url' ? (
            <form
              onSubmit={handleUrlSubmit}
              className="flex flex-col sm:flex-row gap-0 max-w-lg mx-auto mb-8 bg-white rounded-full overflow-hidden border-2 border-[#E8723A]/30"
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
                className="bg-[#E8723A] hover:bg-[#D4612E] text-white rounded-full px-8 m-1.5 font-semibold"
              >
                Analyze
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          ) : (
            <div className="max-w-lg mx-auto mb-8">
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
                  className="bg-[#E8723A] hover:bg-[#D4612E] text-white rounded-full px-8 m-1.5 font-semibold"
                >
                  Get Results
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
              <p className="text-xs text-gray-600 mt-3">
                Get your free evaluation + weekly startup insights. Unsubscribe
                anytime.
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="flex items-start gap-2 max-w-lg mx-auto mb-16 bg-neutral-900/60 border border-neutral-800 rounded-lg px-4 py-3 text-left">
            <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">
              <span className="text-gray-400 font-medium">Disclaimer:</span> This score is generated from publicly available website data only and is intended for <span className="text-gray-400">directional purposes</span>. It does not constitute investment advice. A comprehensive evaluation would require access to financials, team backgrounds, market data, and other non-public information.
            </p>
          </div>
        </div>
      </section>

      {/* Who is this for */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <Users className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                For Founders
              </h3>
              <p className="text-gray-500 text-sm">
                See your startup through an investor's lens. Understand which signals your website sends about market fit, team, and execution — and where to improve before your next pitch.
              </p>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <TrendingUp className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                For Investors
              </h3>
              <p className="text-gray-500 text-sm">
                Quickly screen startups at the top of your funnel. Get a directional read on a company's online presence, maturity signals, and positioning before diving deeper.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <Globe className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Just Enter a URL
              </h3>
              <p className="text-gray-500 text-sm">
                Paste any startup website and get an instant evaluation — no signup walls before you start.
              </p>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <BarChart3 className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                6 VC Dimensions
              </h3>
              <p className="text-gray-500 text-sm">
                Scored across market opportunity, product-market fit, team quality, business model, competitive advantage, and execution.
              </p>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <Share2 className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Share & Export
              </h3>
              <p className="text-gray-500 text-sm">
                Download CSV reports or share results with your team and co-investors.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="px-4 pb-20">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setShowMethodology(!showMethodology)}
            className="w-full flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-6 py-4 text-left hover:border-neutral-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-[#E8723A]" />
              <span className="text-white font-semibold">
                How We Score Startups — Methodology & Examples
              </span>
            </div>
            {showMethodology ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showMethodology && (
            <div className="mt-4 bg-neutral-900 border border-neutral-800 rounded-lg p-6 space-y-6">
              <div>
                <p className="text-gray-400 text-sm mb-4">
                  Our engine scans publicly available signals from a startup's website and scores across 6 dimensions commonly used by venture capital firms. Each dimension is weighted based on its typical importance in early-stage evaluation.
                </p>
              </div>

              <div className="space-y-4">
                <div className="border-b border-neutral-800 pb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-white font-medium">Market Opportunity</h4>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">20% weight</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-2">How large and growing is the addressable market?</p>
                  <p className="text-gray-600 text-xs"><span className="text-gray-400">Signals:</span> Tech indicators, growth messaging, enterprise focus, careers page, customer traction, content strategy.</p>
                  <p className="text-gray-600 text-xs mt-1"><span className="text-gray-400">Example:</span> A startup with keywords like "AI", "enterprise", a careers page, and customer numbers will score higher than one with a minimal landing page.</p>
                </div>

                <div className="border-b border-neutral-800 pb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-white font-medium">Product-Market Fit</h4>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">20% weight</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-2">Is there evidence the product solves a real problem?</p>
                  <p className="text-gray-600 text-xs"><span className="text-gray-400">Signals:</span> Social proof, testimonials, customer metrics, pricing page, clear CTAs, integrations, revenue mentions.</p>
                  <p className="text-gray-600 text-xs mt-1"><span className="text-gray-400">Example:</span> "Trusted by 500+ companies" with a pricing page and API docs signals strong product-market fit.</p>
                </div>

                <div className="border-b border-neutral-800 pb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-white font-medium">Team Quality</h4>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">20% weight</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-2">Does the team appear credible and capable?</p>
                  <p className="text-gray-600 text-xs"><span className="text-gray-400">Signals:</span> Team/about page, careers page, LinkedIn presence, social channels, investor backing mentions.</p>
                  <p className="text-gray-600 text-xs mt-1"><span className="text-gray-400">Example:</span> A team page with founders' bios, LinkedIn links, "YC-backed" mention, and open job listings signals a strong team.</p>
                </div>

                <div className="border-b border-neutral-800 pb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-white font-medium">Business Model</h4>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">15% weight</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-2">Is there a clear path to revenue?</p>
                  <p className="text-gray-600 text-xs"><span className="text-gray-400">Signals:</span> Pricing page, revenue indicators, freemium/free trial, enterprise sales motion, subscription model, customer base.</p>
                  <p className="text-gray-600 text-xs mt-1"><span className="text-gray-400">Example:</span> A SaaS with a visible pricing page showing monthly/annual tiers and a "Contact Sales" option scores well here.</p>
                </div>

                <div className="border-b border-neutral-800 pb-4">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-white font-medium">Competitive Advantage</h4>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">15% weight</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-2">What makes this startup defensible?</p>
                  <p className="text-gray-600 text-xs"><span className="text-gray-400">Signals:</span> Technology moat, proprietary/patent mentions, unique positioning, integration ecosystem, social proof, funding.</p>
                  <p className="text-gray-600 text-xs mt-1"><span className="text-gray-400">Example:</span> Mentioning "proprietary AI" with deep API docs and funded status signals a competitive moat.</p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-white font-medium">Execution Capability</h4>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">10% weight</span>
                  </div>
                  <p className="text-gray-500 text-sm mb-2">How well does the team ship and operate?</p>
                  <p className="text-gray-600 text-xs"><span className="text-gray-400">Signals:</span> SSL, SEO optimization, blog/content, careers, clear CTAs, multi-channel presence, site depth, support channels.</p>
                  <p className="text-gray-600 text-xs mt-1"><span className="text-gray-400">Example:</span> A well-structured site with SSL, rich meta tags, an active blog, and multiple social channels shows strong execution.</p>
                </div>
              </div>

              <div className="bg-neutral-800/50 rounded-lg p-4 mt-4">
                <p className="text-gray-400 text-sm">
                  <span className="text-white font-medium">How the overall score works:</span> Each category is scored 0–95 based on detected signals. The overall score is the weighted average across all 6 dimensions. For example, a startup scoring 70 in Market Opportunity (20% weight) contributes 14 points to the overall score.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
