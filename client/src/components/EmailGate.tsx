import { useState } from 'react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'

interface EmailGateProps {
  email: string
  onSuccess: () => void
}

export default function EmailGate({ email, onSuccess }: EmailGateProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    setIsLoading(true)
    try {
      // Call backend API to subscribe to Beehiiv
      const response = await axios.post('/api/subscribe', { email })
      
      if (response.status === 200) {
        toast.success('Welcome! Redirecting to scorer...')
        setTimeout(onSuccess, 500)
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 'Failed to subscribe. Please try again.'
      toast.error(errorMsg)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="bg-slate-800/50 border-slate-700 p-8 max-w-md w-full">
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
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
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

        <p className="text-xs text-slate-500 text-center mt-4">
          We respect your privacy. Unsubscribe anytime.
        </p>
      </Card>
    </div>
  )
}
