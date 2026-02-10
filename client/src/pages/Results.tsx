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
  const [, navigate] = useLocation()

  useEffect(() => {
    const url = sessionStorage.getItem('eval_url')
    const email = sessionStorage.getItem('eval_email')

    if (!url || !email) {
      navigate('/')
      return
    }

    async function run() {
      // Subscribe email in background (don't block on failure)
      axios
        .post('/api/subscribe', { email }, { timeout: 10000 })
        .catch(() => {})

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
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/30'
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/30'
    if (score >= 40) return 'bg-orange-500/10 border-orange-500/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 65) return 'Strong'
    if (score >= 50) return 'Moderate'
    if (score >= 35) return 'Developing'
    return 'Early Stage'
  }

  const handleShare = () => {
    if (!result) return
    const shareText = `I evaluated ${result.companyName} and it scored ${result.overallScore}/100 on the Startup Rating Tool. Get your free startup evaluation at eval.angelsround.com`
    navigator.clipboard.writeText(shareText)
    toast.success('Copied to clipboard!')
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">
            Analyzing Startup...
          </h2>
          <p className="text-slate-400 max-w-md">
            We're scanning the website, evaluating key signals across 6
            dimensions, and generating your VC-grade scorecard.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800/50 border-slate-700 p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">
            Analysis Failed
          </h2>
          <p className="text-slate-400 mb-6">{error}</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-blue-600 hover:bg-blue-700 text-white"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/')}
            className="text-sm text-slate-400 hover:text-white mb-4 flex items-center gap-1"
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
            className="text-sm text-blue-400 hover:underline"
          >
            {result.url}
          </a>
          {result.description && (
            <p className="text-slate-400 mt-2 max-w-2xl">
              {result.description}
            </p>
          )}
        </div>

        {/* Overall Score */}
        <Card className={`${getScoreBg(result.overallScore)} border p-8 mb-8`}>
          <div className="text-center">
            <p className="text-slate-400 mb-2 text-sm uppercase tracking-wide">
              Overall Rating
            </p>
            <p
              className={`text-7xl font-black ${getScoreColor(result.overallScore)}`}
            >
              {result.overallScore}
            </p>
            <p className="text-slate-400 mt-1">/100</p>
            <p
              className={`text-lg font-semibold mt-2 ${getScoreColor(result.overallScore)}`}
            >
              {getScoreLabel(result.overallScore)}
            </p>
          </div>
        </Card>

        {/* Summary */}
        <Card className="bg-slate-800/50 border-slate-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-white mb-2">Summary</h2>
          <p className="text-slate-300 leading-relaxed">{result.summary}</p>
        </Card>

        {/* Category Scores */}
        <div className="space-y-4 mb-8">
          <h2 className="text-lg font-semibold text-white">
            Detailed Breakdown
          </h2>
          {result.categories.map((category, index) => (
            <Card
              key={index}
              className="bg-slate-800/50 border-slate-700 overflow-hidden"
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
                    <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
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
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Score bar */}
                <div className="w-full bg-slate-700/50 rounded-full h-2">
                  <div
                    className={`${getScoreBarColor(category.score)} h-2 rounded-full transition-all`}
                    style={{ width: `${category.score}%` }}
                  />
                </div>
              </button>

              {expandedCategory === index && (
                <div className="px-6 pb-6 border-t border-slate-700/50 pt-4">
                  <p className="text-slate-300 mb-4">{category.reasoning}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-400">
                      Key Signals:
                    </p>
                    <ul className="space-y-1">
                      {category.signals.map((signal, i) => (
                        <li
                          key={i}
                          className="text-sm text-slate-300 flex items-start gap-2"
                        >
                          <span className="text-blue-400 mt-1 shrink-0">
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
          <Button
            onClick={handleShare}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Results
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            Evaluate Another
          </Button>
        </div>
      </div>
    </div>
  )
}
