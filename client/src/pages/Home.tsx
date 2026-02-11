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

    sessionStorage.setItem('eval_url', websiteUrl.trim())
    sessionStorage.setItem('eval_email', email.trim())

    toast.success('Analyzing startup...')
    navigate('/results')
  }

  return (
    <div className="min-h-screen bg-black">
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-[#E8723A]/15 border border-[#E8723A]/40 rounded-lg">
            <p className="text-sm font-semibold text-[#E8723A]">
              AI-Powered Startup Analysis
            </p>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Rate Any Startup
            <br />
            <span className="text-[#E8723A]">By Its Website</span>
          </h1>

          <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
            Enter any startup's website and get an instant VC-grade evaluation
            across 6 key dimensions. Powered by data-driven analysis.
          </p>

          {step === 'url' ? (
            <form
              onSubmit={handleUrlSubmit}
              className="flex flex-col sm:flex-row gap-0 max-w-lg mx-auto mb-12 bg-white rounded-full overflow-hidden border-2 border-[#E8723A]/30"
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
            <div className="max-w-lg mx-auto mb-12">
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

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <Globe className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Just Enter a URL
              </h3>
              <p className="text-gray-500">
                Paste any startup website and get an instant evaluation
              </p>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <BarChart3 className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                6 VC Dimensions
              </h3>
              <p className="text-gray-500">
                Scored on market, team, product-fit, model, moat, and execution
              </p>
            </Card>
            <Card className="bg-neutral-900 border-neutral-800 p-6">
              <Share2 className="w-8 h-8 text-[#E8723A] mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                Share & Export
              </h3>
              <p className="text-gray-500">
                Download CSV reports or share results with your team
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
