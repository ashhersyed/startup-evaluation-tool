import { useState } from 'react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { ArrowRight, Globe, Mail, BarChart3, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLocation } from 'wouter'

export default function Home() {
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'url' | 'email'>('url')
  const [, navigate] = useLocation()

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!websiteUrl.trim()) {
      toast.error('Please enter a website URL')
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

    // Store in sessionStorage for the results page
    sessionStorage.setItem('eval_url', websiteUrl.trim())
    sessionStorage.setItem('eval_email', email.trim())

    toast.success('Analyzing startup...')
    navigate('/results')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-lg">
            <p className="text-sm font-semibold text-blue-400">
              AI-Powered Startup Analysis
            </p>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Rate Any Startup
            <br />
            <span className="text-blue-400">By Its Website</span>
          </h1>

          <p className="text-xl text-slate-300 mb-10 max-w-xl mx-auto">
            Enter any startup's website and get an instant VC-grade evaluation
            across 6 key dimensions. Powered by data-driven analysis.
          </p>

          {step === 'url' ? (
            <form
              onSubmit={handleUrlSubmit}
              className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-12"
            >
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="e.g. stripe.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Analyze
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          ) : (
            <div className="max-w-lg mx-auto mb-12">
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="text-sm text-slate-300 truncate">
                  {websiteUrl}
                </span>
                <button
                  onClick={() => setStep('url')}
                  className="ml-auto text-xs text-blue-400 hover:text-blue-300"
                >
                  Change
                </button>
              </div>
              <form
                onSubmit={handleEmailSubmit}
                className="flex flex-col sm:flex-row gap-3"
              >
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Get Results
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
              <p className="text-xs text-slate-500 mt-3">
                Get your free evaluation + weekly startup insights. Unsubscribe
                anytime.
              </p>
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <Globe className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Just Enter a URL
              </h3>
              <p className="text-slate-400">
                Paste any startup website and get an instant evaluation
              </p>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <BarChart3 className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                6 VC Dimensions
              </h3>
              <p className="text-slate-400">
                Scored on market, team, product-fit, model, moat, and execution
              </p>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <Share2 className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Share & Export
              </h3>
              <p className="text-slate-400">
                Download CSV reports or share results with your team
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
