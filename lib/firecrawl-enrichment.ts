/**
 * Firecrawl utility for enriching subcontractor data
 * Uses Firecrawl's search and extract APIs to find and populate subcontractor information
 */

const FIRECRAWL_API_BASE_URL = 'https://api.firecrawl.dev'

interface EnrichmentResult {
  email?: string | null
  phone?: string | null
  website_url?: string | null
  google_review_score?: number | null
  google_reviews_link?: string | null
  time_in_business?: string | null
  jobs_completed?: number | null
  licensed?: boolean | null
  bonded?: boolean | null
  notes?: string | null
  references?: unknown
  profile_picture_url?: string | null
}

interface FirecrawlSearchResult {
  url: string
  title?: string
  description?: string
}

interface FirecrawlExtractResult {
  business_name?: string
  phone?: string
  email?: string
  website?: string
  city?: string
  services?: string
  google_review_score?: number
  google_reviews_link?: string
  time_in_business?: string
  licensed?: boolean
  bonded?: boolean
  notes?: string
}

/**
 * Search for a subcontractor using Firecrawl search API
 */
export async function searchSubcontractor(
  name: string,
  location: string,
  tradeCategory: string,
  apiKey: string
): Promise<FirecrawlSearchResult[]> {
  try {
    const query = `"${name}" ${tradeCategory} ${location} contractor`
    console.log(`🔍 Searching Firecrawl: "${query}"`)

    const response = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 10,
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      throw new Error(`Firecrawl search failed: ${response.status}`)
    }

    const data = await response.json()
    const results = data.data?.web || data.data || []
    console.log(`📊 Found ${results.length} search results`)

    return results
  } catch (error) {
    console.error('Firecrawl search error:', error)
    throw error
  }
}

/**
 * Extract structured data from a URL using Firecrawl extract API
 */
export async function extractSubcontractorData(
  url: string,
  apiKey: string
): Promise<FirecrawlExtractResult | null> {
  let retries = 3
  let lastError: Error | null = null

  while (retries > 0) {
    try {
      console.log(`📄 Extracting data from: ${url}`)

      const response = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/extract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          schema: {
            business_name: 'string',
            phone: 'string',
            email: 'string',
            website: 'string',
            city: 'string',
            services: 'string',
            google_review_score: 'number',
            google_reviews_link: 'string',
            time_in_business: 'string',
            licensed: 'boolean',
            bonded: 'boolean',
            notes: 'string',
          },
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.data || null
      }

      // Handle rate limits with exponential backoff
      if (response.status === 429) {
        const waitTime = Math.pow(2, 4 - retries) * 1000
        console.log(`⏳ Rate limited, waiting ${waitTime}ms before retry...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
        retries--
        continue
      }

      throw new Error(`Extract failed: ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      retries--
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  console.error(`❌ Firecrawl extract error for "${url}":`, lastError?.message || 'Unknown error')
  return null
}

/**
 * Search for Google Reviews information
 */
export async function searchGoogleReviews(
  businessName: string,
  location: string,
  apiKey: string
): Promise<{ score?: number; link?: string } | null> {
  try {
    const query = `"${businessName}" reviews ${location} site:google.com`
    console.log(`🌐 Searching Google Reviews: "${query}"`)

    const response = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 3,
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const results = data.data?.web || data.data || []

    if (results.length > 0) {
      // Try to extract from the first Google result
      const googleUrl = results[0].url
      const extractResult = await extractSubcontractorData(googleUrl, apiKey)

      if (extractResult) {
        return {
          score: extractResult.google_review_score || undefined,
          link: extractResult.google_reviews_link || googleUrl,
        }
      }
    }

    return null
  } catch (error) {
    console.error('Google Reviews search error:', error)
    return null
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

/**
 * Enrich a subcontractor with data from Firecrawl
 */
export async function enrichSubcontractor(
  subcontractor: {
    id: string
    name: string
    email: string
    trade_category: string
    location: string
    website_url?: string | null
  },
  apiKey: string
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {}
  const needsEmail = !subcontractor.email || !isValidEmail(subcontractor.email)

  try {
    // Import image extraction utilities
    const { getProfilePictureOrFavicon } = await import('./firecrawl-image-extraction')
    // If we have a website, try to extract data from it first
    if (subcontractor.website_url) {
      const extractData = await extractSubcontractorData(subcontractor.website_url, apiKey)
      if (extractData) {
        // Extract email if we need it and it's valid
        if (needsEmail && extractData.email) {
          const email = String(extractData.email).trim().toLowerCase()
          if (isValidEmail(email)) {
            result.email = email
          }
        }
        result.phone = extractData.phone ? String(extractData.phone).trim() || null : null
        result.website_url = extractData.website ? String(extractData.website).trim() || null : subcontractor.website_url || null
        result.time_in_business = extractData.time_in_business ? String(extractData.time_in_business).trim() || null : null
        result.licensed = extractData.licensed !== undefined ? Boolean(extractData.licensed) : null
        result.bonded = extractData.bonded !== undefined ? Boolean(extractData.bonded) : null
        // Ensure google_review_score is a valid number between 0 and 5
        if (extractData.google_review_score !== undefined && extractData.google_review_score !== null) {
          const score = Number(extractData.google_review_score)
          result.google_review_score = !isNaN(score) && score >= 0 && score <= 5 ? score : null
        } else {
          result.google_review_score = null
        }
        result.google_reviews_link = extractData.google_reviews_link ? String(extractData.google_reviews_link).trim() || null : null
      }
    }

    // Search for the business if we don't have enough data (email, phone, or website)
    if (needsEmail || !result.phone || !result.website_url) {
      const searchResults = await searchSubcontractor(
        subcontractor.name,
        subcontractor.location,
        subcontractor.trade_category,
        apiKey
      )

      // Try to extract from the most relevant search results
      for (const searchResult of searchResults.slice(0, 3)) {
        const extractData = await extractSubcontractorData(searchResult.url, apiKey)
        if (extractData) {
          // Extract email if we still need it and it's valid
          if (needsEmail && !result.email && extractData.email) {
            const email = String(extractData.email).trim().toLowerCase()
            if (isValidEmail(email)) {
              result.email = email
            }
          }
          if (!result.phone && extractData.phone) {
            result.phone = String(extractData.phone).trim() || null
          }
          if (!result.website_url && extractData.website) {
            result.website_url = String(extractData.website).trim() || null
          }
          if (!result.time_in_business && extractData.time_in_business) {
            result.time_in_business = String(extractData.time_in_business).trim() || null
          }
          if (result.licensed === null && extractData.licensed !== undefined) {
            result.licensed = Boolean(extractData.licensed)
          }
          if (result.bonded === null && extractData.bonded !== undefined) {
            result.bonded = Boolean(extractData.bonded)
          }
          // Update google_review_score if we don't have one yet
          if (!result.google_review_score && extractData.google_review_score !== undefined && extractData.google_review_score !== null) {
            const score = Number(extractData.google_review_score)
            result.google_review_score = !isNaN(score) && score >= 0 && score <= 5 ? score : null
          }
          if (!result.google_reviews_link && extractData.google_reviews_link) {
            result.google_reviews_link = String(extractData.google_reviews_link).trim() || null
          }

          // If we found key data (email if needed, phone, and website), break early
          if ((!needsEmail || result.email) && result.phone && result.website_url) {
            break
          }
        }

        // Add delay between extractions to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    // Search for Google Reviews if we don't have review data
    if (!result.google_review_score || !result.google_reviews_link) {
      const googleReviews = await searchGoogleReviews(
        subcontractor.name,
        subcontractor.location,
        apiKey
      )
      if (googleReviews) {
        if (googleReviews.score !== undefined && googleReviews.score !== null) {
          const score = Number(googleReviews.score)
          if (!isNaN(score) && score >= 0 && score <= 5) {
            result.google_review_score = score
          }
        }
        if (googleReviews.link) {
          result.google_reviews_link = String(googleReviews.link).trim() || null
        }
      }
    }

    // Try to get profile picture or favicon from website
    const websiteUrl = result.website_url || subcontractor.website_url
    if (websiteUrl) {
      try {
        const profilePicture = await getProfilePictureOrFavicon(websiteUrl, apiKey)
        if (profilePicture) {
          result.profile_picture_url = profilePicture
        }
      } catch (error) {
        console.warn('Error extracting profile picture:', error)
        // Don't fail the whole enrichment if image extraction fails
      }
    }

    return result
  } catch (error) {
    console.error('Error enriching subcontractor:', error)
    throw error
  }
}






