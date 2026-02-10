import * as cheerio from 'cheerio'
import axios from 'axios'

export interface CategoryScore {
  name: string
  score: number
  weight: number
  reasoning: string
  signals: string[]
}

export interface AnalysisResult {
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
  scriptCount: number
  hasSSL: boolean
  wordCount: number
}

function extractSiteData(html: string, url: string): SiteData {
  const $ = cheerio.load(html)
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().toLowerCase()
  const allText = bodyText

  const links = $('a')
    .map((_, el) => $(el).attr('href') || '')
    .get()
    .filter(Boolean)

  const domain = new URL(url).hostname
  const internalLinks = links.filter(
    (l) => l.startsWith('/') || l.includes(domain)
  )
  const externalLinks = links.filter(
    (l) => l.startsWith('http') && !l.includes(domain)
  )

  const socialDomains = [
    'twitter.com',
    'x.com',
    'linkedin.com',
    'facebook.com',
    'instagram.com',
    'youtube.com',
    'github.com',
    'tiktok.com',
  ]
  const socialLinks = externalLinks.filter((l) =>
    socialDomains.some((d) => l.includes(d))
  )

  const navText = internalLinks.join(' ').toLowerCase()
  const linkTexts = $('a')
    .map((_, el) => $(el).text().toLowerCase())
    .get()
    .join(' ')

  const hasTeamPage =
    /\b(team|about.us|our.team|people|leadership|founders)\b/.test(navText) ||
    /\b(team|about us|our team|people|leadership|founders)\b/.test(linkTexts)
  const hasPricingPage =
    /\b(pricing|plans|packages|cost|subscribe)\b/.test(navText) ||
    /\b(pricing|plans|packages)\b/.test(linkTexts)
  const hasBlogPage =
    /\b(blog|news|articles|insights|resources)\b/.test(navText) ||
    /\b(blog|news|articles|insights)\b/.test(linkTexts)
  const hasAboutPage =
    /\b(about|company|mission|story|who.we.are)\b/.test(navText) ||
    /\b(about|company|our story)\b/.test(linkTexts)
  const hasCareersPage =
    /\b(careers|jobs|hiring|work.with.us|join.us|open.positions)\b/.test(
      navText
    ) ||
    /\b(careers|jobs|hiring|join us)\b/.test(linkTexts)
  const hasContactPage =
    /\b(contact|get.in.touch|support|help)\b/.test(navText) ||
    /\b(contact|get in touch|support)\b/.test(linkTexts)

  const socialProofKeywords = [
    'trusted by',
    'used by',
    'customers',
    'clients',
    'testimonial',
    'case study',
    'case studies',
    'reviews',
    'rating',
    'featured in',
    'as seen on',
    'partners',
    'companies use',
  ]
  const hasSocialProof = socialProofKeywords.some((kw) => allText.includes(kw))

  const ctaKeywords = [
    'get started',
    'sign up',
    'start free',
    'try free',
    'book a demo',
    'request demo',
    'schedule demo',
    'contact sales',
    'free trial',
    'start trial',
    'join now',
    'subscribe',
    'buy now',
  ]
  const hasClearCTA = ctaKeywords.some((kw) => allText.includes(kw))

  const techKeywords = [
    'api',
    'sdk',
    'integration',
    'platform',
    'saas',
    'cloud',
    'ai',
    'machine learning',
    'blockchain',
    'automation',
    'analytics',
    'dashboard',
    'real-time',
    'scalable',
  ]
  const techIndicators = techKeywords.filter((kw) => allText.includes(kw))

  const mentionsFunding =
    /\b(funded|raised|series [a-e]|seed round|investors|backed by|venture|yc|y combinator|accelerator)\b/.test(
      allText
    )
  const mentionsRevenue =
    /\b(revenue|arr|mrr|profitable|monetiz|pricing|subscription|freemium|enterprise)\b/.test(
      allText
    )
  const mentionsCustomers =
    /\b(\d+[k+m+]?\s*(customers|users|clients|companies|teams|businesses))\b/.test(
      allText
    ) || hasSocialProof
  const mentionsGrowth =
    /\b(growing|growth|scale|scaling|expand|traction|momentum)\b/.test(allText)

  const headings = $('h1, h2, h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((h) => h.length > 0)
    .slice(0, 20)

  return {
    title: $('title').text().trim(),
    metaDescription: $('meta[name="description"]').attr('content') || '',
    ogTitle: $('meta[property="og:title"]').attr('content') || '',
    ogDescription: $('meta[property="og:description"]').attr('content') || '',
    ogImage: $('meta[property="og:image"]').attr('content') || '',
    headings,
    bodyText: allText.slice(0, 5000),
    links,
    internalLinks,
    externalLinks,
    hasTeamPage,
    hasPricingPage,
    hasBlogPage,
    hasAboutPage,
    hasCareersPage,
    hasContactPage,
    hasSocialProof,
    socialLinks,
    hasClearCTA,
    techIndicators,
    mentionsFunding,
    mentionsRevenue,
    mentionsCustomers,
    mentionsGrowth,
    imageCount: $('img').length,
    scriptCount: $('script').length,
    hasSSL: url.startsWith('https'),
    wordCount: allText.split(/\s+/).length,
  }
}

function scoreMarketOpportunity(data: SiteData): CategoryScore {
  let score = 30
  const signals: string[] = []

  // Tech/innovation indicators suggest growing markets
  if (data.techIndicators.length >= 3) {
    score += 15
    signals.push(
      `Technology-forward approach (${data.techIndicators.slice(0, 4).join(', ')})`
    )
  } else if (data.techIndicators.length >= 1) {
    score += 8
    signals.push(`Some tech indicators (${data.techIndicators.join(', ')})`)
  }

  // Mentions of growth/scale suggest large market
  if (data.mentionsGrowth) {
    score += 10
    signals.push('Growth-oriented messaging detected')
  }

  // Enterprise or B2B signals often mean larger TAM
  if (
    data.bodyText.includes('enterprise') ||
    data.bodyText.includes('business')
  ) {
    score += 8
    signals.push('Enterprise/B2B market focus')
  }

  // Customer count mentions suggest validated market
  if (data.mentionsCustomers) {
    score += 12
    signals.push('Customer traction validates market demand')
  }

  // Rich content suggests they understand their market
  if (data.hasBlogPage) {
    score += 5
    signals.push('Content strategy indicates market awareness')
  }

  // Careers page suggests they are scaling
  if (data.hasCareersPage) {
    score += 8
    signals.push('Actively hiring suggests market confidence')
  }

  if (signals.length === 0) {
    signals.push('Limited market signals detected from website')
  }

  return {
    name: 'Market Opportunity',
    score: Math.min(score, 95),
    weight: 0.2,
    reasoning:
      score >= 65
        ? 'Strong market opportunity signals based on technology focus, customer evidence, and growth indicators.'
        : score >= 45
          ? 'Moderate market signals. Some indicators of market opportunity but could be clearer.'
          : 'Limited market opportunity signals. Website does not clearly communicate market size or growth potential.',
    signals,
  }
}

function scoreProductMarketFit(data: SiteData): CategoryScore {
  let score = 20
  const signals: string[] = []

  if (data.hasSocialProof) {
    score += 20
    signals.push('Social proof present (testimonials, logos, or case studies)')
  }

  if (data.mentionsCustomers) {
    score += 15
    signals.push('Customer metrics referenced')
  }

  if (data.hasClearCTA) {
    score += 10
    signals.push('Clear call-to-action indicates active user acquisition')
  }

  if (data.hasPricingPage) {
    score += 12
    signals.push('Pricing page suggests monetized product')
  }

  if (data.mentionsRevenue) {
    score += 10
    signals.push('Revenue or monetization indicators found')
  }

  // Integration/API mentions suggest product stickiness
  if (
    data.bodyText.includes('integration') ||
    data.bodyText.includes('api')
  ) {
    score += 8
    signals.push('Integration capabilities suggest product stickiness')
  }

  if (data.hasBlogPage) {
    score += 5
    signals.push('Content marketing supports user engagement')
  }

  if (signals.length === 0) {
    signals.push(
      'No clear product-market fit signals detected. Consider adding social proof and customer evidence.'
    )
  }

  return {
    name: 'Product-Market Fit',
    score: Math.min(score, 95),
    weight: 0.2,
    reasoning:
      score >= 65
        ? 'Strong product-market fit indicators including social proof and customer evidence.'
        : score >= 45
          ? 'Some product-market fit signals detected but room for improvement.'
          : 'Weak product-market fit signals. Website lacks customer evidence and social proof.',
    signals,
  }
}

function scoreTeamQuality(data: SiteData): CategoryScore {
  let score = 25
  const signals: string[] = []

  if (data.hasTeamPage) {
    score += 20
    signals.push('Dedicated team/about page demonstrates transparency')
  }

  if (data.hasAboutPage) {
    score += 10
    signals.push('About page provides company background')
  }

  if (data.hasCareersPage) {
    score += 15
    signals.push('Careers page indicates team growth and organizational maturity')
  }

  if (data.socialLinks.length >= 3) {
    score += 10
    signals.push(
      `Active social presence (${data.socialLinks.length} platforms)`
    )
  } else if (data.socialLinks.length >= 1) {
    score += 5
    signals.push('Some social media presence')
  }

  if (data.mentionsFunding) {
    score += 12
    signals.push('Funding/investor backing suggests vetted team')
  }

  // LinkedIn presence is a strong team signal
  if (data.socialLinks.some((l) => l.includes('linkedin'))) {
    score += 5
    signals.push('LinkedIn presence for professional credibility')
  }

  if (signals.length === 0) {
    signals.push(
      'Limited team information found. Consider adding team/about page.'
    )
  }

  return {
    name: 'Team Quality',
    score: Math.min(score, 95),
    weight: 0.2,
    reasoning:
      score >= 65
        ? 'Team transparency and credibility signals are strong.'
        : score >= 45
          ? 'Some team information available but could be more comprehensive.'
          : 'Minimal team information. Adding a team page and social links would improve this score.',
    signals,
  }
}

function scoreBusinessModel(data: SiteData): CategoryScore {
  let score = 20
  const signals: string[] = []

  if (data.hasPricingPage) {
    score += 25
    signals.push('Clear pricing page demonstrates revenue model')
  }

  if (data.mentionsRevenue) {
    score += 15
    signals.push('Revenue/monetization strategy indicators found')
  }

  if (
    data.bodyText.includes('freemium') ||
    data.bodyText.includes('free trial') ||
    data.bodyText.includes('free plan')
  ) {
    score += 10
    signals.push('Freemium model reduces acquisition friction')
  }

  if (
    data.bodyText.includes('enterprise') ||
    data.bodyText.includes('contact sales')
  ) {
    score += 10
    signals.push('Enterprise sales motion indicates higher-value contracts')
  }

  if (
    data.bodyText.includes('subscription') ||
    data.bodyText.includes('monthly') ||
    data.bodyText.includes('annual')
  ) {
    score += 10
    signals.push('Recurring revenue model detected')
  }

  if (data.mentionsCustomers) {
    score += 8
    signals.push('Customer base validates business model')
  }

  if (signals.length === 0) {
    signals.push(
      'No clear business model signals. Website does not indicate how the company generates revenue.'
    )
  }

  return {
    name: 'Business Model',
    score: Math.min(score, 95),
    weight: 0.15,
    reasoning:
      score >= 65
        ? 'Clear business model with defined revenue streams and pricing strategy.'
        : score >= 45
          ? 'Business model partially visible. Some monetization signals detected.'
          : 'Business model unclear from website. Adding a pricing page would significantly improve this.',
    signals,
  }
}

function scoreCompetitiveAdvantage(data: SiteData): CategoryScore {
  let score = 25
  const signals: string[] = []

  if (data.techIndicators.length >= 3) {
    score += 15
    signals.push('Technology moat with multiple tech differentiators')
  }

  if (
    data.bodyText.includes('patent') ||
    data.bodyText.includes('proprietary')
  ) {
    score += 15
    signals.push('IP/proprietary technology mentioned')
  }

  if (
    data.bodyText.includes('only') ||
    data.bodyText.includes('first') ||
    data.bodyText.includes('unique')
  ) {
    score += 8
    signals.push('Unique positioning language detected')
  }

  if (data.bodyText.includes('integration') || data.bodyText.includes('api')) {
    score += 10
    signals.push('Integration ecosystem creates switching costs')
  }

  if (data.hasSocialProof) {
    score += 10
    signals.push('Social proof creates trust-based competitive advantage')
  }

  if (data.mentionsFunding) {
    score += 8
    signals.push('Funding provides competitive runway')
  }

  if (data.wordCount > 1000 && data.headings.length > 5) {
    score += 5
    signals.push('Detailed content suggests deep domain expertise')
  }

  if (signals.length === 0) {
    signals.push(
      'Limited competitive advantage signals. Consider highlighting unique differentiators.'
    )
  }

  return {
    name: 'Competitive Advantage',
    score: Math.min(score, 95),
    weight: 0.15,
    reasoning:
      score >= 65
        ? 'Strong defensibility signals through technology, positioning, and ecosystem effects.'
        : score >= 45
          ? 'Some competitive advantages detected but moat could be stronger.'
          : 'Weak competitive advantage signals. Website needs clearer differentiation messaging.',
    signals,
  }
}

function scoreExecutionCapability(data: SiteData): CategoryScore {
  let score = 30
  const signals: string[] = []

  // A well-built website itself is an execution signal
  if (data.hasSSL) {
    score += 5
    signals.push('SSL secured site')
  }

  if (data.ogImage && data.ogTitle && data.metaDescription) {
    score += 10
    signals.push('Well-optimized SEO and social metadata')
  }

  if (data.imageCount > 3) {
    score += 5
    signals.push('Rich visual content')
  }

  if (data.hasBlogPage) {
    score += 10
    signals.push('Active content production demonstrates execution')
  }

  if (data.hasCareersPage) {
    score += 10
    signals.push('Scaling team shows execution momentum')
  }

  if (data.hasClearCTA) {
    score += 8
    signals.push('Clear CTAs show focused execution on user acquisition')
  }

  if (data.socialLinks.length >= 2) {
    score += 8
    signals.push('Multi-channel presence shows execution breadth')
  }

  if (data.internalLinks.length > 10) {
    score += 5
    signals.push('Comprehensive site structure')
  }

  if (data.hasContactPage) {
    score += 5
    signals.push('Accessible contact/support channels')
  }

  if (signals.length === 0) {
    signals.push('Limited execution signals from website analysis.')
  }

  return {
    name: 'Execution Capability',
    score: Math.min(score, 95),
    weight: 0.1,
    reasoning:
      score >= 65
        ? 'Strong execution signals across website quality, content, and organizational maturity.'
        : score >= 45
          ? 'Decent execution evident but some areas could be improved.'
          : 'Website suggests early-stage execution. Improving site quality and content would help.',
    signals,
  }
}

function generateSummary(
  companyName: string,
  overallScore: number,
  categories: CategoryScore[]
): string {
  const topCategories = [...categories]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
  const weakCategories = [...categories]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)

  let verdict: string
  if (overallScore >= 75) {
    verdict = `${companyName} shows strong potential as a startup investment opportunity.`
  } else if (overallScore >= 55) {
    verdict = `${companyName} shows moderate potential with clear areas for improvement.`
  } else if (overallScore >= 35) {
    verdict = `${companyName} is in early stages with significant room for development.`
  } else {
    verdict = `${companyName} has limited signals of startup maturity based on the website analysis.`
  }

  const strengths = `Strongest areas: ${topCategories.map((c) => `${c.name} (${c.score}/100)`).join(', ')}.`
  const improvements = `Areas for improvement: ${weakCategories.map((c) => `${c.name} (${c.score}/100)`).join(', ')}.`

  return `${verdict} ${strengths} ${improvements}`
}

export async function analyzeStartup(url: string): Promise<AnalysisResult> {
  // Normalize URL
  let normalizedUrl = url.trim()
  if (
    !normalizedUrl.startsWith('http://') &&
    !normalizedUrl.startsWith('https://')
  ) {
    normalizedUrl = `https://${normalizedUrl}`
  }

  // Fetch the website
  const response = await axios.get(normalizedUrl, {
    timeout: 15000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; StartupEvaluator/1.0; +https://eval.angelsround.com)',
      Accept: 'text/html,application/xhtml+xml',
    },
    maxRedirects: 5,
  })

  const html = response.data
  const siteData = extractSiteData(html, normalizedUrl)

  // Extract company name from title or OG tags
  const companyName =
    siteData.ogTitle ||
    siteData.title.split(/[|\-–—]/).map((s) => s.trim())[0] ||
    new URL(normalizedUrl).hostname.replace('www.', '')

  const description =
    siteData.ogDescription ||
    siteData.metaDescription ||
    siteData.headings[0] ||
    ''

  // Score each category
  const categories: CategoryScore[] = [
    scoreMarketOpportunity(siteData),
    scoreProductMarketFit(siteData),
    scoreTeamQuality(siteData),
    scoreBusinessModel(siteData),
    scoreCompetitiveAdvantage(siteData),
    scoreExecutionCapability(siteData),
  ]

  // Calculate overall weighted score
  const overallScore = Math.round(
    categories.reduce((sum, cat) => sum + cat.score * cat.weight, 0)
  )

  const summary = generateSummary(companyName, overallScore, categories)

  return {
    companyName,
    url: normalizedUrl,
    description,
    overallScore,
    categories,
    summary,
  }
}
