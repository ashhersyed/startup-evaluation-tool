import express, { Request, Response } from 'express'
import cors from 'cors'
import axios from 'axios'
import { analyzeStartup } from '../lib/analyzer'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Environment variables
const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY
const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUB_ID

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Subscribe endpoint
app.post('/api/subscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    if (!BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) {
      return res.status(500).json({ message: 'Server configuration error' })
    }

    // Call Beehiiv API
    const response = await axios.post(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUB_ID}/subscriptions`,
      {
        email,
        reactivate_existing_subscriber: true,
        send_welcome_email: true,
      },
      {
        headers: {
          Authorization: `Bearer ${BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return res.status(200).json({
      message: 'Successfully subscribed',
      subscriber: response.data,
    })
  } catch (error: any) {
    console.error('Beehiiv API error:', error.response?.data || error.message)

    if (error.response?.status === 409) {
      // Subscriber already exists
      return res.status(200).json({
        message: 'Already subscribed',
      })
    }

    return res.status(500).json({
      message: error.response?.data?.message || 'Failed to subscribe',
    })
  }
})

// Analyze endpoint
app.post('/api/analyze', async (req: Request, res: Response) => {
  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ message: 'URL is required' })
    }

    const result = await analyzeStartup(url)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Analysis error:', error)

    if (
      error.cause?.code === 'ENOTFOUND' ||
      error.cause?.code === 'ECONNREFUSED' ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('fetch failed')
    ) {
      return res.status(400).json({
        message:
          'Could not reach the website. Please check the URL and try again.',
      })
    }

    if (error.message?.includes('Invalid URL')) {
      return res.status(400).json({
        message: 'Invalid URL format. Please enter a valid website address.',
      })
    }

    if (error.name === 'AbortError') {
      return res.status(400).json({
        message: 'Website took too long to respond. Please try again.',
      })
    }

    return res.status(500).json({
      message: `Failed to analyze the website: ${error.message || 'Unknown error'}`,
    })
  }
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
