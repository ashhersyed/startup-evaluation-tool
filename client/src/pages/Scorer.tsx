import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Slider } from '../components/ui/slider'
import { Share2, Download } from 'lucide-react'
import { toast } from 'sonner'

interface ScoreCategory {
  name: string
  description: string
  weight: number
  score: number
}

const CATEGORIES: ScoreCategory[] = [
  {
    name: 'Market Opportunity',
    description: 'Size and growth potential of the addressable market',
    weight: 0.2,
    score: 50,
  },
  {
    name: 'Product-Market Fit',
    description: 'Evidence of product-market fit and customer traction',
    weight: 0.2,
    score: 50,
  },
  {
    name: 'Team Quality',
    description: 'Founder experience and team capability',
    weight: 0.2,
    score: 50,
  },
  {
    name: 'Business Model',
    description: 'Revenue model and unit economics',
    weight: 0.15,
    score: 50,
  },
  {
    name: 'Competitive Advantage',
    description: 'Defensibility and unique positioning',
    weight: 0.15,
    score: 50,
  },
  {
    name: 'Execution Capability',
    description: 'Ability to execute on vision',
    weight: 0.1,
    score: 50,
  },
]

export default function Scorer() {
  const [startupName, setStartupName] = useState('')
  const [categories, setCategories] = useState(CATEGORIES)

  const handleScoreChange = (index: number, value: number[]) => {
    const newCategories = [...categories]
    newCategories[index].score = value[0]
    setCategories(newCategories)
  }

  const calculateWeightedScore = () => {
    return Math.round(
      categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0)
    )
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-yellow-500'
    if (score >= 40) return 'text-orange-500'
    return 'text-red-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/30'
    if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/30'
    if (score >= 40) return 'bg-orange-500/10 border-orange-500/30'
    return 'bg-red-500/10 border-red-500/30'
  }

  const overallScore = calculateWeightedScore()

  const handleShare = () => {
    const shareText = `I scored ${startupName || 'this startup'} ${overallScore}/100 on the Startup Evaluation Tool. Check it out at eval.angelsround.com`
    navigator.clipboard.writeText(shareText)
    toast.success('Copied to clipboard!')
  }

  const handleExport = () => {
    const csv = [
      ['Startup Evaluation Report'],
      ['Startup Name', startupName || 'Unknown'],
      ['Overall Score', overallScore],
      [],
      ['Category', 'Score', 'Weight'],
      ...categories.map(cat => [cat.name, cat.score, `${cat.weight * 100}%`]),
    ]
      .map(row => row.join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${startupName || 'evaluation'}-score.csv`
    a.click()
    toast.success('Downloaded!')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Startup Evaluator</h1>
          <p className="text-slate-400">Score startups using VC evaluation criteria</p>
        </div>

        {/* Startup Name Input */}
        <Card className="bg-slate-800/50 border-slate-700 p-6 mb-8">
          <label className="block text-sm font-semibold text-white mb-2">
            Startup Name
          </label>
          <Input
            placeholder="Enter startup name"
            value={startupName}
            onChange={(e) => setStartupName(e.target.value)}
            className="bg-slate-700/50 border-slate-600 text-white"
          />
        </Card>

        {/* Overall Score */}
        <Card className={`${getScoreBg(overallScore)} border p-8 mb-8`}>
          <div className="text-center">
            <p className="text-slate-400 mb-2">Overall Score</p>
            <p className={`text-6xl font-black ${getScoreColor(overallScore)}`}>
              {overallScore}
            </p>
            <p className="text-slate-400 mt-2">/100</p>
          </div>
        </Card>

        {/* Scoring Categories */}
        <div className="space-y-6 mb-8">
          {categories.map((category, index) => (
            <Card key={index} className="bg-slate-800/50 border-slate-700 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                  <p className="text-sm text-slate-400">{category.description}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${getScoreColor(category.score)}`}>
                    {category.score}
                  </p>
                  <p className="text-xs text-slate-500">{category.weight * 100}% weight</p>
                </div>
              </div>
              <Slider
                value={[category.score]}
                onValueChange={(value) => handleScoreChange(index, value)}
                min={0}
                max={100}
                step={1}
                className="w-full"
              />
            </Card>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            onClick={handleShare}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  )
}
