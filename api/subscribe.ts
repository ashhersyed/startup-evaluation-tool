import { VercelRequest, VercelResponse } from '@vercel/node'
import axios from 'axios'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ message: 'Email is required' })
    }

    const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY
    const BEEHIIV_PUB_ID = process.env.BEEHIIV_PUB_ID

    if (!BEEHIIV_API_KEY || !BEEHIIV_PUB_ID) {
      console.error('Missing Beehiiv environment variables')
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
}
