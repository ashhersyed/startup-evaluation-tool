import { useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { ArrowRight, Zap } from 'lucide-react'
import { toast } from 'sonner'
import EmailGate from '../components/EmailGate'

export default function Home() {
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showGate, setShowGate] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email address')
      return
    }
    setShowGate(true)
  }

  if (showGate) {
    return <EmailGate email={email} onSuccess={() => setLocation('/scorer')} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg">
            <p className="text-sm font-semibold text-blue-400">Evaluate Startups Like a VC</p>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Score Startups<br />
            <span className="text-blue-400">Instantly</span>
          </h1>

          <p className="text-xl text-slate-300 mb-8 max-w-xl mx-auto">
            Use our evaluation framework trusted by top investors to assess startup potential in seconds.
          </p>

          {/* Email Capture Form */}
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-12">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'Loading...' : 'Get Started'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <Zap className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Fast Evaluation</h3>
              <p className="text-slate-400">Score any startup in under 2 minutes</p>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <Zap className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">VC Framework</h3>
              <p className="text-slate-400">Based on real investor evaluation criteria</p>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <Zap className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Shareable Results</h3>
              <p className="text-slate-400">Share your evaluation with one click</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
