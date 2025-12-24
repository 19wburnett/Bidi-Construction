/**
 * Free Subcontractor Enrichment Engine
 * 
 * Uses DuckDuckGo HTML search and Cheerio for web scraping
 * NO paid APIs or API keys required
 */

import * as cheerio from 'cheerio'

// Rate limiting: minimum delay between requests
const REQUEST_DELAY_MS = 1000

// User agent to avoid blocks
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Search result from DuckDuckGo
 */
export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Enrichment results extracted from websites
 */
export interface EnrichmentResults {
  profile_summary: string | null
  services: string[] | null
  phone: string | null
  service_area: string | null
  website_url: string | null
  logo_url: string | null
  licensed_claimed: boolean | null
  bonded_claimed: boolean | null
  insured_claimed: boolean | null
  google_reviews_link: string | null
  yelp_link: string | null
  bbb_link: string | null
}

/**
 * Source information for each extracted field
 */
export interface FieldSource {
  source_url: string
  confidence: number // 0-1
  extracted_text?: string
}

export interface EnrichmentSources {
  [field: string]: FieldSource
}

/**
 * Crawled page data
 */
interface CrawledPage {
  url: string
  html: string
  title: string
}

/**
 * Sleep for rate limiting
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch a URL with proper headers and error handling
 */
async function fetchWithRetry(url: string, retries = 3): Promise<string | null> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        console.warn(`Fetch failed for ${url}: ${response.status}`)
        if (attempt < retries - 1) {
          await sleep(1000 * (attempt + 1))
          continue
        }
        return null
      }

      return await response.text()
    } catch (error) {
      console.warn(`Fetch error for ${url}:`, error instanceof Error ? error.message : 'Unknown error')
      if (attempt < retries - 1) {
        await sleep(1000 * (attempt + 1))
      }
    }
  }
  return null
}

/**
 * Search DuckDuckGo HTML for company information
 */
export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodedQuery}`
    
    console.log(`🔍 Searching DuckDuckGo: "${query}"`)
    
    const html = await fetchWithRetry(searchUrl)
    if (!html) {
      console.warn('Failed to fetch DuckDuckGo results')
      return results
    }

    const $ = cheerio.load(html)
    
    // Parse search results from DuckDuckGo HTML
    $('.result').each((_, element) => {
      const $el = $(element)
      const $link = $el.find('.result__a')
      const $snippet = $el.find('.result__snippet')
      
      const title = $link.text().trim()
      let url = $link.attr('href') || ''
      const snippet = $snippet.text().trim()
      
      // DuckDuckGo wraps URLs - extract the actual URL
      if (url.includes('uddg=')) {
        try {
          const urlParams = new URLSearchParams(url.split('?')[1])
          url = urlParams.get('uddg') || url
          url = decodeURIComponent(url)
        } catch {
          // Keep original URL if parsing fails
        }
      }
      
      if (title && url && url.startsWith('http')) {
        results.push({ title, url, snippet })
      }
    })

    console.log(`📊 Found ${results.length} search results`)
    return results.slice(0, 10) // Return top 10 results
    
  } catch (error) {
    console.error('DuckDuckGo search error:', error)
    return results
  }
}

/**
 * Identify the most likely official website from search results
 */
export function identifyOfficialWebsite(
  results: SearchResult[],
  companyName: string,
  location: string
): SearchResult | null {
  if (results.length === 0) return null
  
  const companyLower = companyName.toLowerCase()
  const locationLower = location.toLowerCase()
  
  // Score each result
  const scored = results.map(result => {
    let score = 0
    const urlLower = result.url.toLowerCase()
    const titleLower = result.title.toLowerCase()
    const snippetLower = result.snippet.toLowerCase()
    
    // Prefer results that contain company name in URL
    const companyWords = companyLower.split(/\s+/).filter(w => w.length > 2)
    for (const word of companyWords) {
      if (urlLower.includes(word)) score += 10
      if (titleLower.includes(word)) score += 5
    }
    
    // Penalize directory sites
    const directories = ['yelp.com', 'yellowpages.com', 'bbb.org', 'linkedin.com', 'facebook.com', 'google.com/maps', 'manta.com', 'angieslist.com', 'homeadvisor.com', 'thumbtack.com', 'houzz.com']
    for (const dir of directories) {
      if (urlLower.includes(dir)) {
        score -= 20
      }
    }
    
    // Prefer .com domains
    if (urlLower.includes('.com')) score += 3
    
    // Location match
    if (snippetLower.includes(locationLower) || titleLower.includes(locationLower)) {
      score += 5
    }
    
    // Prefer shorter URLs (likely homepage)
    const urlParts = result.url.split('/').filter(Boolean)
    if (urlParts.length <= 3) score += 2
    
    return { result, score }
  })
  
  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)
  
  // Return best result if score is positive
  if (scored[0] && scored[0].score > 0) {
    return scored[0].result
  }
  
  // Fall back to first non-directory result
  for (const { result } of scored) {
    const urlLower = result.url.toLowerCase()
    const isDirectory = ['yelp.com', 'yellowpages.com', 'bbb.org', 'linkedin.com', 'facebook.com'].some(d => urlLower.includes(d))
    if (!isDirectory) {
      return result
    }
  }
  
  return results[0] // Last resort
}

/**
 * Crawl a website's homepage and key pages
 */
export async function crawlWebsite(baseUrl: string): Promise<CrawledPage[]> {
  const pages: CrawledPage[] = []
  const visitedUrls = new Set<string>()
  
  // Normalize base URL
  let normalizedBase = baseUrl
  if (!normalizedBase.startsWith('http')) {
    normalizedBase = `https://${normalizedBase}`
  }
  
  try {
    const urlObj = new URL(normalizedBase)
    normalizedBase = urlObj.origin
  } catch {
    console.warn(`Invalid base URL: ${baseUrl}`)
    return pages
  }
  
  // Pages to crawl
  const pagesToCrawl = [
    normalizedBase,
    `${normalizedBase}/about`,
    `${normalizedBase}/about-us`,
    `${normalizedBase}/about-us.html`,
    `${normalizedBase}/services`,
    `${normalizedBase}/our-services`,
    `${normalizedBase}/contact`,
    `${normalizedBase}/contact-us`,
  ]
  
  for (const pageUrl of pagesToCrawl) {
    if (visitedUrls.has(pageUrl)) continue
    visitedUrls.add(pageUrl)
    
    await sleep(REQUEST_DELAY_MS)
    
    const html = await fetchWithRetry(pageUrl)
    if (html) {
      const $ = cheerio.load(html)
      const title = $('title').text().trim()
      pages.push({ url: pageUrl, html, title })
      console.log(`   ✓ Crawled: ${pageUrl}`)
    }
  }
  
  return pages
}

/**
 * Extract profile data from crawled pages
 */
export function extractProfileData(
  pages: CrawledPage[],
  companyName: string
): { results: EnrichmentResults; sources: EnrichmentSources } {
  const results: EnrichmentResults = {
    profile_summary: null,
    services: null,
    phone: null,
    service_area: null,
    website_url: pages[0]?.url || null,
    logo_url: null,
    licensed_claimed: null,
    bonded_claimed: null,
    insured_claimed: null,
    google_reviews_link: null,
    yelp_link: null,
    bbb_link: null,
  }
  
  const sources: EnrichmentSources = {}
  
  if (pages.length === 0) return { results, sources }
  
  // Combine all page content for analysis
  const allText: string[] = []
  
  for (const page of pages) {
    const $ = cheerio.load(page.html)
    
    // Remove script and style tags
    $('script, style, nav, header, footer').remove()
    
    // Extract text
    const pageText = $('body').text().replace(/\s+/g, ' ').trim()
    allText.push(pageText)
    
    // Extract meta description for summary
    if (!results.profile_summary) {
      const metaDesc = $('meta[name="description"]').attr('content')
      const ogDesc = $('meta[property="og:description"]').attr('content')
      const description = metaDesc || ogDesc
      
      if (description && description.length > 20 && description.length < 500) {
        results.profile_summary = description.trim()
        sources.profile_summary = {
          source_url: page.url,
          confidence: 0.9,
          extracted_text: description.substring(0, 100),
        }
      }
    }
    
    // Extract phone numbers
    if (!results.phone) {
      const phoneMatch = pageText.match(/(?:\+1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g)
      if (phoneMatch) {
        // Clean up phone number
        const phone = phoneMatch[0].replace(/[^\d+]/g, '')
        if (phone.length >= 10) {
          results.phone = formatPhoneNumber(phone)
          sources.phone = {
            source_url: page.url,
            confidence: 0.8,
            extracted_text: phoneMatch[0],
          }
        }
      }
    }
    
    // Extract og:image for logo
    if (!results.logo_url) {
      const ogImage = $('meta[property="og:image"]').attr('content')
      if (ogImage) {
        results.logo_url = makeAbsoluteUrl(ogImage, page.url)
        sources.logo_url = {
          source_url: page.url,
          confidence: 0.9,
        }
      }
    }
    
    // Look for logo in img tags
    if (!results.logo_url) {
      const logoImg = $('img[class*="logo"], img[id*="logo"], img[alt*="logo"], header img').first()
      const logoSrc = logoImg.attr('src')
      if (logoSrc) {
        results.logo_url = makeAbsoluteUrl(logoSrc, page.url)
        sources.logo_url = {
          source_url: page.url,
          confidence: 0.7,
        }
      }
    }
    
    // Find review links
    $('a').each((_, el) => {
      const href = $(el).attr('href') || ''
      const hrefLower = href.toLowerCase()
      
      if (!results.google_reviews_link && (hrefLower.includes('google.com/maps') || hrefLower.includes('g.page') || hrefLower.includes('goo.gl/maps'))) {
        results.google_reviews_link = href
        sources.google_reviews_link = {
          source_url: page.url,
          confidence: 0.9,
        }
      }
      
      if (!results.yelp_link && hrefLower.includes('yelp.com/biz')) {
        results.yelp_link = href
        sources.yelp_link = {
          source_url: page.url,
          confidence: 0.9,
        }
      }
      
      if (!results.bbb_link && hrefLower.includes('bbb.org/')) {
        results.bbb_link = href
        sources.bbb_link = {
          source_url: page.url,
          confidence: 0.9,
        }
      }
    })
    
    // Check for licensing/bonding claims
    const textLower = pageText.toLowerCase()
    
    if (results.licensed_claimed === null) {
      if (textLower.includes('licensed') && (textLower.includes('contractor') || textLower.includes('we are licensed') || textLower.includes('fully licensed'))) {
        results.licensed_claimed = true
        sources.licensed_claimed = {
          source_url: page.url,
          confidence: 0.7,
          extracted_text: 'Licensed contractor claim found',
        }
      }
    }
    
    if (results.bonded_claimed === null) {
      if (textLower.includes('bonded') && (textLower.includes('we are') || textLower.includes('fully bonded') || textLower.includes('and bonded'))) {
        results.bonded_claimed = true
        sources.bonded_claimed = {
          source_url: page.url,
          confidence: 0.7,
          extracted_text: 'Bonded claim found',
        }
      }
    }
    
    if (results.insured_claimed === null) {
      if (textLower.includes('insured') && (textLower.includes('fully insured') || textLower.includes('we are insured') || textLower.includes('and insured'))) {
        results.insured_claimed = true
        sources.insured_claimed = {
          source_url: page.url,
          confidence: 0.7,
          extracted_text: 'Insured claim found',
        }
      }
    }
  }
  
  // Extract services from combined text
  const combinedText = allText.join(' ')
  results.services = extractServices(combinedText, companyName)
  if (results.services && results.services.length > 0) {
    sources.services = {
      source_url: pages[0].url,
      confidence: 0.6,
      extracted_text: results.services.slice(0, 3).join(', '),
    }
  }
  
  // Try to extract summary from first paragraph if not found
  if (!results.profile_summary && pages[0]) {
    const $ = cheerio.load(pages[0].html)
    $('script, style, nav, header, footer').remove()
    const firstP = $('main p, article p, .content p, .about p, p').first().text().trim()
    if (firstP && firstP.length > 50 && firstP.length < 500) {
      results.profile_summary = firstP
      sources.profile_summary = {
        source_url: pages[0].url,
        confidence: 0.5,
        extracted_text: firstP.substring(0, 100),
      }
    }
  }
  
  return { results, sources }
}

/**
 * Extract services from text content
 */
function extractServices(text: string, companyName: string): string[] | null {
  const services: Set<string> = new Set()
  
  // Common construction/trade service keywords
  const servicePatterns = [
    /residential\s+\w+/gi,
    /commercial\s+\w+/gi,
    /new\s+construction/gi,
    /remodel(?:ing|s)?/gi,
    /renovation(?:s)?/gi,
    /repair(?:s)?/gi,
    /installation(?:s)?/gi,
    /maintenance/gi,
    /inspection(?:s)?/gi,
    /emergency\s+(?:service|repair)s?/gi,
    /24[\s/-]?(?:hour|hr)\s+service/gi,
  ]
  
  // Look for services section
  const servicesMatch = text.match(/(?:our\s+)?services?(?:\s+include)?:?\s*([^.]{50,500})/i)
  if (servicesMatch) {
    const serviceText = servicesMatch[1]
    // Split by common delimiters
    const items = serviceText.split(/[,•\n|]/).map(s => s.trim()).filter(s => s.length > 3 && s.length < 50)
    items.forEach(item => services.add(capitalizeFirst(item)))
  }
  
  // Apply patterns
  for (const pattern of servicePatterns) {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(m => {
        const cleaned = m.trim()
        if (cleaned.length > 5 && cleaned.length < 50) {
          services.add(capitalizeFirst(cleaned))
        }
      })
    }
  }
  
  const result = Array.from(services).slice(0, 10)
  return result.length > 0 ? result : null
}

/**
 * Format phone number consistently
 */
function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

/**
 * Make a URL absolute
 */
function makeAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http')) return url
  if (url.startsWith('//')) return `https:${url}`
  
  try {
    const base = new URL(baseUrl)
    if (url.startsWith('/')) {
      return `${base.origin}${url}`
    }
    return `${base.origin}/${url}`
  } catch {
    return url
  }
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Extract favicon URL as fallback for logo
 */
export async function extractFavicon(baseUrl: string): Promise<string | null> {
  let normalizedBase = baseUrl
  if (!normalizedBase.startsWith('http')) {
    normalizedBase = `https://${normalizedBase}`
  }
  
  try {
    const urlObj = new URL(normalizedBase)
    const origin = urlObj.origin
    
    // Try common favicon locations
    const faviconPaths = [
      '/favicon.ico',
      '/favicon.png',
      '/apple-touch-icon.png',
      '/apple-touch-icon-precomposed.png',
    ]
    
    for (const path of faviconPaths) {
      const faviconUrl = `${origin}${path}`
      try {
        const response = await fetch(faviconUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(3000),
        })
        if (response.ok) {
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('image') || path.endsWith('.ico')) {
            return faviconUrl
          }
        }
      } catch {
        continue
      }
    }
    
    return null
  } catch {
    return null
  }
}

/**
 * Main enrichment function
 */
export async function enrichSubcontractorFree(
  subcontractor: {
    id: string
    name: string
    trade_category: string
    location: string
    website_url?: string | null
  }
): Promise<{ results: EnrichmentResults; sources: EnrichmentSources }> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🔍 ENRICHING: ${subcontractor.name}`)
  console.log(`   Trade: ${subcontractor.trade_category}`)
  console.log(`   Location: ${subcontractor.location}`)
  console.log(`${'='.repeat(60)}`)
  
  let results: EnrichmentResults = {
    profile_summary: null,
    services: null,
    phone: null,
    service_area: null,
    website_url: subcontractor.website_url || null,
    logo_url: null,
    licensed_claimed: null,
    bonded_claimed: null,
    insured_claimed: null,
    google_reviews_link: null,
    yelp_link: null,
    bbb_link: null,
  }
  
  let sources: EnrichmentSources = {}
  
  try {
    let websiteUrl = subcontractor.website_url
    
    // If no website, search for it
    if (!websiteUrl) {
      const searchQuery = `"${subcontractor.name}" ${subcontractor.trade_category} ${subcontractor.location}`
      const searchResults = await searchDuckDuckGo(searchQuery)
      
      const bestResult = identifyOfficialWebsite(
        searchResults,
        subcontractor.name,
        subcontractor.location
      )
      
      if (bestResult) {
        websiteUrl = bestResult.url
        results.website_url = websiteUrl
        sources.website_url = {
          source_url: 'DuckDuckGo search',
          confidence: 0.7,
          extracted_text: bestResult.title,
        }
        console.log(`   📍 Identified website: ${websiteUrl}`)
      }
      
      // Also look for review links in search results
      for (const result of searchResults) {
        const urlLower = result.url.toLowerCase()
        if (!results.google_reviews_link && (urlLower.includes('google.com/maps') || urlLower.includes('g.page'))) {
          results.google_reviews_link = result.url
          sources.google_reviews_link = {
            source_url: 'DuckDuckGo search',
            confidence: 0.8,
          }
        }
        if (!results.yelp_link && urlLower.includes('yelp.com/biz')) {
          results.yelp_link = result.url
          sources.yelp_link = {
            source_url: 'DuckDuckGo search',
            confidence: 0.8,
          }
        }
        if (!results.bbb_link && urlLower.includes('bbb.org/')) {
          results.bbb_link = result.url
          sources.bbb_link = {
            source_url: 'DuckDuckGo search',
            confidence: 0.8,
          }
        }
      }
    }
    
    // Crawl the website if found
    if (websiteUrl) {
      console.log(`   🌐 Crawling website: ${websiteUrl}`)
      const pages = await crawlWebsite(websiteUrl)
      
      if (pages.length > 0) {
        const extracted = extractProfileData(pages, subcontractor.name)
        
        // Merge results
        results = { ...results, ...extracted.results }
        sources = { ...sources, ...extracted.sources }
        
        // Set service area from location if not found
        if (!results.service_area) {
          results.service_area = subcontractor.location
        }
      }
      
      // Get favicon as fallback for logo
      if (!results.logo_url) {
        console.log(`   🖼️ Looking for favicon...`)
        const favicon = await extractFavicon(websiteUrl)
        if (favicon) {
          results.logo_url = favicon
          sources.logo_url = {
            source_url: websiteUrl,
            confidence: 0.4,
            extracted_text: 'Favicon fallback',
          }
        }
      }
    }
    
    console.log(`\n   ✅ Enrichment complete`)
    console.log(`   Fields found: ${Object.entries(results).filter(([_, v]) => v !== null).length}`)
    
    return { results, sources }
    
  } catch (error) {
    console.error('Enrichment error:', error)
    throw error
  }
}

