import { VercelRequest, VercelResponse } from '@vercel/node'
import { analyzeStartup } from '../lib/analyzer'

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ message: 'URL is required' })
    }

    const result = await analyzeStartup(url)
    return res.status(200).json(result)
  } catch (error: any) {
    console.error('Analysis error:', error.message)

    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
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

    return res.status(500).json({
      message: 'Failed to analyze the website. Please try again.',
    })
  }
}
