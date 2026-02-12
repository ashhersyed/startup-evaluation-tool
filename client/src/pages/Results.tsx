import { useState, useEffect } from 'react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import {
  Share2,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  AlertCircle,
  Link2,
  X,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useLocation } from 'wouter'
import axios from 'axios'

interface CategoryScore {
  name: string
  score: number
  weight: number
  reasoning: string
  signals: string[]
}

interface AnalysisResult {
  companyName: string
  url: string
  description: string
  overallScore: number
  categories: CategoryScore[]
  summary: string
}

export default function Results() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [, navigate] = useLocation()

  useEffect(() => {
    const url = sessionStorage.getItem('eval_url')
    const email = sessionStorage.getItem('eval_email')

    if (!url || !email) {
      navigate('/')
      return
    }

    async function run() {
      // Subscribe email to beehiiv
      axios
        .post('/api/subscribe', { email }, { timeout: 10000 })
        .then(() => toast.success('Subscribed to newsletter!'))
        .catch(() => toast.error('Newsletter subscription failed'))

      // Analyze the website
      try {
        const res = await axios.post(
          '/api/analyze',
          { url },
          { timeout: 30000 }
        )
        setResult(res.data)
      } catch (err: any) {
        const msg =
          err.response?.data?.message ||
          `Request failed: ${err.message} (status: ${err.response?.status || 'no response'})`
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [navigate])

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-[#E8723A]'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/30'
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/30'
    if (score >= 40) return 'bg-[#E8723A]/10 border-[#E8723A]/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-[#E8723A]'
    return 'bg-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 65) return 'Strong'
    if (score >= 50) return 'Moderate'
    if (score >= 35) return 'Developing'
    return 'Early Stage'
  }

  const role = sessionStorage.getItem('eval_role') as 'founder' | 'investor' | null

  const getRoleInterpretation = (score: number) => {
    if (role === 'founder') {
      if (score >= 80) return 'Your company shows strong investor-ready signals. You\'re well-positioned for fundraising conversations.'
      if (score >= 65) return 'Solid foundation. Focus on strengthening weaker areas before your next investor pitch.'
      if (score >= 50) return 'Moderate signals. Investors will want to see more traction — add customer proof, pricing, and team visibility.'
      if (score >= 35) return 'Early stage. Focus on product and customers first. Revisit fundraising once you have stronger signals.'
      return 'Very early. Build your product, get initial customers, and develop your online presence before approaching investors.'
    }
    if (role === 'investor') {
      if (score >= 80) return 'Investment-grade signals. This startup warrants due diligence — request financials and schedule a founder meeting.'
      if (score >= 65) return 'Promising. Worth a founder conversation to validate the opportunity beyond public signals.'
      if (score >= 50) return 'Mixed signals. Dig deeper into the team and traction before committing time.'
      if (score >= 35) return 'Early stage. Only consider if you\'re investing at pre-seed or backing the team specifically.'
      return 'Pre-institutional stage. Not ready for traditional VC investment. Revisit if the team shows progress.'
    }
    return null
  }

  const siteUrl = 'https://eval.angelsround.com'

  const getShareText = () => {
    if (!result) return ''
    return `I evaluated ${result.companyName} and it scored ${result.overallScore}/100 on the Startup Rating Tool. Get your free startup evaluation at ${siteUrl}`
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareText())
    toast.success('Copied to clipboard!')
    setShowShareMenu(false)
  }

  const handleShareTwitter = () => {
    if (!result) return
    const text = encodeURIComponent(`${result.companyName} scored ${result.overallScore}/100 on the Startup Rating Tool ⚡\n\nGet your free startup evaluation:`)
    const url = encodeURIComponent(siteUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
    setShowShareMenu(false)
  }

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(siteUrl)
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank')
    setShowShareMenu(false)
  }

  const handleExport = () => {
    if (!result) return
    const csv = [
      ['Startup Evaluation Report'],
      ['Company', result.companyName],
      ['Website', result.url],
      ['Overall Score', String(result.overallScore)],
      ['Summary', `"${result.summary}"`],
      [],
      ['Category', 'Score', 'Weight', 'Reasoning'],
      ...result.categories.map((cat) => [
        cat.name,
        String(cat.score),
        `${cat.weight * 100}%`,
        `"${cat.reasoning}"`,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = window.URL.createObjectURL(blob)
    a.download = `${result.companyName.replace(/\s+/g, '-').toLowerCase()}-evaluation.csv`
    a.click()
    toast.success('Downloaded!')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#E8723A] animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Analyzing Startup...
          </h2>
          <p className="text-gray-500 max-w-md">
            We're scanning the website, evaluating key signals across 6
            dimensions, and generating your VC-grade scorecard.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="bg-neutral-900 border-neutral-800 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Analysis Failed
          </h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-[#E8723A] hover:bg-[#D4612E] text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Try Another URL
          </Button>
        </Card>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-white mb-4 flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Evaluate another startup
          </button>
          <h1 className="text-4xl font-black text-white mb-1">
            {result.companyName}
          </h1>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#E8723A] hover:underline"
          >
            {result.url}
          </a>
          {result.description && (
            <p className="text-gray-500 mt-2 max-w-2xl">
              {result.description}
            </p>
          )}
        </div>

        {/* Overall Score */}
        <Card className={`${getScoreBg(result.overallScore)} border p-8 mb-8`}>
          <div className="text-center">
            <p className="text-gray-500 mb-2 text-sm uppercase tracking-wide">
              Overall Rating
            </p>
            <p
              className={`text-7xl font-black ${getScoreColor(result.overallScore)}`}
            >
              {result.overallScore}
            </p>
            <p className="text-gray-500 mt-1">/100</p>
            <p
              className={`text-lg font-semibold mt-2 ${getScoreColor(result.overallScore)}`}
            >
              {getScoreLabel(result.overallScore)}
            </p>
          </div>
        </Card>

        {/* Role-specific interpretation */}
        {getRoleInterpretation(result.overallScore) && (
          <Card className="bg-[#E8723A]/5 border-[#E8723A]/20 p-5 mb-8">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 px-2 py-0.5 bg-[#E8723A]/15 rounded text-xs font-semibold text-[#E8723A] uppercase">
                {role === 'founder' ? 'Founder' : 'Investor'} Insight
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                {getRoleInterpretation(result.overallScore)}
              </p>
            </div>
          </Card>
        )}

        {/* Summary */}
        <Card className="bg-neutral-900 border-neutral-800 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Summary</h2>
          <p className="text-gray-400 leading-relaxed">{result.summary}</p>
        </Card>

        {/* Category Scores */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-white">
            Detailed Breakdown
          </h2>
          {result.categories.map((category, index) => (
            <Card
              key={index}
              className="bg-neutral-900 border-neutral-800 overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === index ? null : index
                  )
                }
                className="w-full p-6 text-left"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {category.name}
                    </h3>
                    <span className="text-xs text-gray-600 bg-neutral-800 px-2 py-0.5 rounded">
                      {category.weight * 100}% weight
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-2xl font-bold ${getScoreColor(category.score)}`}
                    >
                      {category.score}
                    </span>
                    {expandedCategory === index ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Score bar */}
                <div className="w-full bg-neutral-800 rounded-full h-2">
                  <div
                    className={`${getScoreBarColor(category.score)} h-2 rounded-full transition-all`}
                    style={{ width: `${category.score}%` }}
                  />
                </div>
              </button>

              {expandedCategory === index && (
                <div className="px-6 pb-6 border-t border-neutral-800 pt-4">
                  <p className="text-gray-400 mb-4">{category.reasoning}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">
                      Key Signals:
                    </p>
                    <ul className="space-y-1">
                      {category.signals.map((signal, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-400 flex items-start gap-2"
                        >
                          <span className="text-[#E8723A] mt-1 shrink-0">
                            &bull;
                          </span>
                          {signal}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center pb-12">
          <div className="relative">
            <Button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="bg-[#E8723A] hover:bg-[#D4612E] text-white"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Results
              <ChevronDown className="w-3 h-3 ml-2" />
            </Button>
            {showShareMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowShareMenu(false)}
                />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-20 min-w-[200px] py-1">
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    <Link2 className="w-4 h-4" />
                    Copy to Clipboard
                  </button>
                  <button
                    onClick={handleShareTwitter}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Share on X
                  </button>
                  <button
                    onClick={handleShareLinkedIn}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-neutral-800 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    Share on LinkedIn
                  </button>
                </div>
              </>
            )}
          </div>
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-neutral-700 text-white hover:bg-neutral-800"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="border-neutral-700 text-white hover:bg-neutral-800"
          >
            Evaluate Another
          </Button>
        </div>

        {/* Disclaimer */}
        <div className="flex items-center justify-center gap-2 pb-12 text-center">
          <Info className="w-3.5 h-3.5 text-gray-600 shrink-0" />
          <p className="text-xs text-gray-600">
            This score is based on publicly available website data and is for directional purposes only. It does not constitute investment advice.
          </p>
        </div>
      </div>
    </div>
  )
}
