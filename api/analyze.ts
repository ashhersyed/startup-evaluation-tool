import type { VercelRequest, VercelResponse } from '@vercel/node'

// ---- All analyzer code inlined to avoid cross-directory import issues on Vercel ----

interface CategoryScore {
  name: string
  score: number
  weight: number
  reasoning: string
  signals: string[]
}

interface AnalysisResult {
  companyName: string
  url: string
  description: string
  overallScore: number
  categories: CategoryScore[]
  summary: string
}

interface SiteData {
  title: string
  metaDescription: string
  ogTitle: string
  ogDescription: string
  ogImage: string
  headings: string[]
  bodyText: string
  links: string[]
  internalLinks: string[]
  externalLinks: string[]
  hasTeamPage: boolean
  hasPricingPage: boolean
  hasBlogPage: boolean
  hasAboutPage: boolean
  hasCareersPage: boolean
  hasContactPage: boolean
  hasSocialProof: boolean
  socialLinks: string[]
  hasClearCTA: boolean
  techIndicators: string[]
  mentionsFunding: boolean
  mentionsRevenue: boolean
  mentionsCustomers: boolean
  mentionsGrowth: boolean
  imageCount: number
  hasSSL: boolean
  wordCount: number
}

function getTagContent(html: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = html.match(re)
  return m ? m[1].trim() : ''
}

function getMetaContent(html: string, attr: string, value: string): string {
  const re = new RegExp(
    `<meta[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["']|<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`,
    'i'
  )
  const m = html.match(re)
  return m ? (m[1] || m[2] || '').trim() : ''
}

function getAllHrefs(html: string): string[] {
  const re = /href=["']([^"']+)["']/gi
  const results: string[] = []
  let m
  while ((m = re.exec(html)) !== null) {
    results.push(m[1])
  }
  return results
}

function getAllLinkTexts(html: string): string {
  const re = /<a[^>]*>([\s\S]*?)<\/a>/gi
  const texts: string[] = []
  let m
  while ((m = re.exec(html)) !== null) {
    texts.push(m[1].replace(/<[^>]*>/g, '').trim())
  }
  return texts.join(' ').toLowerCase()
}

function getHeadings(html: string): string[] {
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi
  const results: string[] = []
  let m
  while ((m = re.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]*>/g, '').trim()
    if (text.length > 0) results.push(text)
  }
  return results.slice(0, 20)
}

function stripHtml(html: string): string {
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<[^>]*>/g, ' ')
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  text = text.replace(/\s+/g, ' ').trim()
  return text.toLowerCase()
}

function countTag(html: string, tag: string): number {
  const re = new RegExp(`<${tag}[\\s/>]`, 'gi')
  return (html.match(re) || []).length
}

function extractSiteData(html: string, url: string): SiteData {
  const allText = stripHtml(html)
  const links = getAllHrefs(html)
  const linkTexts = getAllLinkTexts(html)
  const domain = new URL(url).hostname
  const internalLinks = links.filter((l) => l.startsWith('/') || l.includes(domain))
  const externalLinks = links.filter((l) => l.startsWith('http') && !l.includes(domain))

  const socialDomains = ['twitter.com', 'x.com', 'linkedin.com', 'facebook.com', 'instagram.com', 'youtube.com', 'github.com', 'tiktok.com']
  const socialLinks = externalLinks.filter((l) => socialDomains.some((d) => l.includes(d)))
  const navText = links.join(' ').toLowerCase()

  const hasTeamPage = /\b(team|about.us|our.team|people|leadership|founders)\b/.test(navText) || /\b(team|about us|our team|people|leadership|founders)\b/.test(linkTexts)
  const hasPricingPage = /\b(pricing|plans|packages|cost|subscribe)\b/.test(navText) || /\b(pricing|plans|packages)\b/.test(linkTexts)
  const hasBlogPage = /\b(blog|news|articles|insights|resources)\b/.test(navText) || /\b(blog|news|articles|insights)\b/.test(linkTexts)
  const hasAboutPage = /\b(about|company|mission|story|who.we.are)\b/.test(navText) || /\b(about|company|our story)\b/.test(linkTexts)
  const hasCareersPage = /\b(careers|jobs|hiring|work.with.us|join.us|open.positions)\b/.test(navText) || /\b(careers|jobs|hiring|join us)\b/.test(linkTexts)
  const hasContactPage = /\b(contact|get.in.touch|support|help)\b/.test(navText) || /\b(contact|get in touch|support)\b/.test(linkTexts)

  const hasSocialProof = ['trusted by', 'used by', 'customers', 'clients', 'testimonial', 'case study', 'case studies', 'reviews', 'rating', 'featured in', 'as seen on', 'partners', 'companies use'].some((kw) => allText.includes(kw))
  const hasClearCTA = ['get started', 'sign up', 'start free', 'try free', 'book a demo', 'request demo', 'schedule demo', 'contact sales', 'free trial', 'start trial', 'join now', 'subscribe', 'buy now'].some((kw) => allText.includes(kw))
  const techIndicators = ['api', 'sdk', 'integration', 'platform', 'saas', 'cloud', 'ai', 'machine learning', 'blockchain', 'automation', 'analytics', 'dashboard', 'real-time', 'scalable'].filter((kw) => allText.includes(kw))

  const mentionsFunding = /\b(funded|raised|series [a-e]|seed round|investors|backed by|venture|yc|y combinator|accelerator)\b/.test(allText)
  const mentionsRevenue = /\b(revenue|arr|mrr|profitable|monetiz|pricing|subscription|freemium|enterprise)\b/.test(allText)
  const mentionsCustomers = /\b(\d+[k+m+]?\s*(customers|users|clients|companies|teams|businesses))\b/.test(allText) || hasSocialProof
  const mentionsGrowth = /\b(growing|growth|scale|scaling|expand|traction|momentum)\b/.test(allText)

  return {
    title: getTagContent(html, 'title'),
    metaDescription: getMetaContent(html, 'name', 'description'),
    ogTitle: getMetaContent(html, 'property', 'og:title'),
    ogDescription: getMetaContent(html, 'property', 'og:description'),
    ogImage: getMetaContent(html, 'property', 'og:image'),
    headings: getHeadings(html),
    bodyText: allText.slice(0, 5000),
    links, internalLinks, externalLinks,
    hasTeamPage, hasPricingPage, hasBlogPage, hasAboutPage, hasCareersPage, hasContactPage,
    hasSocialProof, socialLinks, hasClearCTA, techIndicators,
    mentionsFunding, mentionsRevenue, mentionsCustomers, mentionsGrowth,
    imageCount: countTag(html, 'img'),
    hasSSL: url.startsWith('https'),
    wordCount: allText.split(/\s+/).length,
  }
}

function scoreCategory(name: string, weight: number, data: SiteData): CategoryScore {
  let score = 0
  const signals: string[] = []

  switch (name) {
    case 'Market Opportunity': {
      score = 30
      if (data.techIndicators.length >= 3) { score += 15; signals.push(`Technology-forward (${data.techIndicators.slice(0, 4).join(', ')})`) }
      else if (data.techIndicators.length >= 1) { score += 8; signals.push(`Tech indicators (${data.techIndicators.join(', ')})`) }
      if (data.mentionsGrowth) { score += 10; signals.push('Growth-oriented messaging') }
      if (data.bodyText.includes('enterprise') || data.bodyText.includes('business')) { score += 8; signals.push('Enterprise/B2B market focus') }
      if (data.mentionsCustomers) { score += 12; signals.push('Customer traction validates demand') }
      if (data.hasBlogPage) { score += 5; signals.push('Content strategy shows market awareness') }
      if (data.hasCareersPage) { score += 8; signals.push('Hiring suggests market confidence') }
      break
    }
    case 'Product-Market Fit': {
      score = 20
      if (data.hasSocialProof) { score += 20; signals.push('Social proof present') }
      if (data.mentionsCustomers) { score += 15; signals.push('Customer metrics referenced') }
      if (data.hasClearCTA) { score += 10; signals.push('Clear CTAs for user acquisition') }
      if (data.hasPricingPage) { score += 12; signals.push('Pricing page suggests monetization') }
      if (data.mentionsRevenue) { score += 10; signals.push('Revenue indicators found') }
      if (data.bodyText.includes('integration') || data.bodyText.includes('api')) { score += 8; signals.push('Integration capabilities') }
      if (data.hasBlogPage) { score += 5; signals.push('Content marketing present') }
      break
    }
    case 'Team Quality': {
      score = 25
      if (data.hasTeamPage) { score += 20; signals.push('Team/about page shows transparency') }
      if (data.hasAboutPage) { score += 10; signals.push('About page provides background') }
      if (data.hasCareersPage) { score += 15; signals.push('Careers page shows growth') }
      if (data.socialLinks.length >= 3) { score += 10; signals.push(`${data.socialLinks.length} social platforms`) }
      else if (data.socialLinks.length >= 1) { score += 5; signals.push('Social media presence') }
      if (data.mentionsFunding) { score += 12; signals.push('Investor backing detected') }
      if (data.socialLinks.some((l) => l.includes('linkedin'))) { score += 5; signals.push('LinkedIn presence') }
      break
    }
    case 'Business Model': {
      score = 20
      if (data.hasPricingPage) { score += 25; signals.push('Clear pricing page') }
      if (data.mentionsRevenue) { score += 15; signals.push('Revenue strategy indicators') }
      if (data.bodyText.includes('freemium') || data.bodyText.includes('free trial') || data.bodyText.includes('free plan')) { score += 10; signals.push('Freemium model detected') }
      if (data.bodyText.includes('enterprise') || data.bodyText.includes('contact sales')) { score += 10; signals.push('Enterprise sales motion') }
      if (data.bodyText.includes('subscription') || data.bodyText.includes('monthly') || data.bodyText.includes('annual')) { score += 10; signals.push('Recurring revenue model') }
      if (data.mentionsCustomers) { score += 8; signals.push('Customer base validates model') }
      break
    }
    case 'Competitive Advantage': {
      score = 25
      if (data.techIndicators.length >= 3) { score += 15; signals.push('Technology moat') }
      if (data.bodyText.includes('patent') || data.bodyText.includes('proprietary')) { score += 15; signals.push('IP/proprietary tech') }
      if (data.bodyText.includes('only') || data.bodyText.includes('first') || data.bodyText.includes('unique')) { score += 8; signals.push('Unique positioning') }
      if (data.bodyText.includes('integration') || data.bodyText.includes('api')) { score += 10; signals.push('Integration ecosystem') }
      if (data.hasSocialProof) { score += 10; signals.push('Trust-based advantage') }
      if (data.mentionsFunding) { score += 8; signals.push('Funded competitive runway') }
      if (data.wordCount > 1000 && data.headings.length > 5) { score += 5; signals.push('Deep domain expertise') }
      break
    }
    case 'Execution Capability': {
      score = 30
      if (data.hasSSL) { score += 5; signals.push('SSL secured') }
      if (data.ogImage && data.ogTitle && data.metaDescription) { score += 10; signals.push('SEO optimized') }
      if (data.imageCount > 3) { score += 5; signals.push('Rich visuals') }
      if (data.hasBlogPage) { score += 10; signals.push('Active content production') }
      if (data.hasCareersPage) { score += 10; signals.push('Team scaling') }
      if (data.hasClearCTA) { score += 8; signals.push('Focused user acquisition') }
      if (data.socialLinks.length >= 2) { score += 8; signals.push('Multi-channel presence') }
      if (data.internalLinks.length > 10) { score += 5; signals.push('Comprehensive site') }
      if (data.hasContactPage) { score += 5; signals.push('Support channels') }
      break
    }
  }

  if (signals.length === 0) signals.push(`Limited ${name.toLowerCase()} signals detected`)
  score = Math.min(score, 95)

  const reasoning = score >= 65
    ? `Strong ${name.toLowerCase()} signals detected from website analysis.`
    : score >= 45
      ? `Moderate ${name.toLowerCase()} signals. Some indicators present but room for improvement.`
      : `Limited ${name.toLowerCase()} signals. This is an area for improvement.`

  return { name, score, weight, reasoning, signals }
}

async function analyzeStartup(url: string): Promise<AnalysisResult> {
  let normalizedUrl = url.trim()
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  let html: string
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Website returned status ${response.status}`)
    html = await response.text()
  } finally {
    clearTimeout(timeoutId)
  }

  const siteData = extractSiteData(html, normalizedUrl)

  const companyName = siteData.ogTitle || siteData.title.split(/[|\-–—]/).map((s) => s.trim())[0] || new URL(normalizedUrl).hostname.replace('www.', '')
  const description = siteData.ogDescription || siteData.metaDescription || siteData.headings[0] || ''

  const categories: CategoryScore[] = [
    scoreCategory('Market Opportunity', 0.2, siteData),
    scoreCategory('Product-Market Fit', 0.2, siteData),
    scoreCategory('Team Quality', 0.2, siteData),
    scoreCategory('Business Model', 0.15, siteData),
    scoreCategory('Competitive Advantage', 0.15, siteData),
    scoreCategory('Execution Capability', 0.1, siteData),
  ]

  const overallScore = Math.round(categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0))

  const top = [...categories].sort((a, b) => b.score - a.score).slice(0, 2)
  const weak = [...categories].sort((a, b) => a.score - b.score).slice(0, 2)
  let verdict = overallScore >= 75 ? `${companyName} shows strong potential.`
    : overallScore >= 55 ? `${companyName} shows moderate potential with areas for improvement.`
    : overallScore >= 35 ? `${companyName} is in early stages with room for development.`
    : `${companyName} has limited maturity signals from website analysis.`
  const summary = `${verdict} Strongest: ${top.map((c) => `${c.name} (${c.score}/100)`).join(', ')}. Improve: ${weak.map((c) => `${c.name} (${c.score}/100)`).join(', ')}.`

  return { companyName, url: normalizedUrl, description, overallScore, categories, summary }
}

// ---- Vercel handler ----

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    if (error.cause?.code === 'ENOTFOUND' || error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      return res.status(400).json({ message: 'Could not reach the website. Please check the URL and try again.' })
    }
    if (error.message?.includes('Invalid URL')) {
      return res.status(400).json({ message: 'Invalid URL format. Please enter a valid website address.' })
    }
    if (error.name === 'AbortError') {
      return res.status(400).json({ message: 'Website took too long to respond. Please try again.' })
    }
    return res.status(500).json({ message: `Analysis error: ${error.message || 'Unknown error'}` })
  }
}
