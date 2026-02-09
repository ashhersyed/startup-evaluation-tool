import { useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { ArrowRight, Zap } from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email address')
      return
    }
    setShowModal(true)
  }

  const handleSubscribe = async () => {
    setIsLoading(true)
    try {
      // Call backend API to subscribe to Beehiiv
      await axios.post('/api/subscribe', { email }, {
        timeout: 10000,
      })
      
      toast.success('Welcome! Redirecting to scorer...')
      // Navigate to scorer after a short delay
      setTimeout(() => {
        setLocation('/scorer')
      }, 1000)
    } catch (error: any) {
      console.error('Subscription error:', error)
      
      // If backend is not available yet, still allow access
      if (!error.response) {
        toast.success('Welcome! Redirecting to scorer...')
        setTimeout(() => {
          setLocation('/scorer')
        }, 1000)
        return
      }
      
      const errorMsg = error.response?.data?.message || 'Failed to subscribe. Please try again.'
      toast.error(errorMsg)
      setIsLoading(false)
    }
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
            />
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Get Started
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

      {/* Email Gate Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-slate-800/95 border-slate-700 p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-2">Join Our Community</h2>
            <p className="text-slate-400 mb-6">
              Get weekly startup insights and evaluation tips delivered to your inbox.
            </p>

            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-300">
                <span className="font-semibold">{email}</span>
              </p>
            </div>

            <Button
              onClick={handleSubscribe}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Subscribing...
                </>
              ) : (
                'Continue to Scorer'
              )}
            </Button>

            <Button
              onClick={() => {
                setShowModal(false)
                setEmail('')
              }}
              disabled={isLoading}
              variant="outline"
              className="w-full border-slate-600 text-white hover:bg-slate-700"
            >
              Cancel
            </Button>

            <p className="text-xs text-slate-500 text-center mt-4">
              We respect your privacy. Unsubscribe anytime.
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
