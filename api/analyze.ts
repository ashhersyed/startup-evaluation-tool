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
}
