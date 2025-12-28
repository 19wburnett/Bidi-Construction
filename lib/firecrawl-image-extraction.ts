/**
 * Utility functions for extracting profile pictures and favicons from websites
 */

/**
 * Try to get favicon from common locations
 */
export async function getFaviconUrl(websiteUrl: string): Promise<string | null> {
  if (!websiteUrl) return null

  try {
    const url = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`)
    const baseUrl = `${url.protocol}//${url.host}`

    // Common favicon locations
    const faviconPaths = [
      '/favicon.ico',
      '/favicon.png',
      '/favicon.jpg',
      '/apple-touch-icon.png',
      '/logo.png',
      '/logo.jpg',
      '/images/favicon.ico',
      '/images/logo.png',
    ]

    // Try each common path
    for (const path of faviconPaths) {
      try {
        const faviconUrl = `${baseUrl}${path}`
        const response = await fetch(faviconUrl, { method: 'HEAD', signal: AbortSignal.timeout(3000) })
        if (response.ok && response.headers.get('content-type')?.startsWith('image/')) {
          return faviconUrl
        }
      } catch {
        // Continue to next path
        continue
      }
    }

    // Try to get from HTML meta tags
    try {
      const htmlResponse = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) })
      if (htmlResponse.ok) {
        const html = await htmlResponse.text()
        // Look for favicon in link tags
        const faviconMatch = html.match(/<link[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/i)
        if (faviconMatch && faviconMatch[1]) {
          let faviconUrl = faviconMatch[1]
          // Make absolute URL if relative
          if (faviconUrl.startsWith('/')) {
            faviconUrl = `${baseUrl}${faviconUrl}`
          } else if (!faviconUrl.startsWith('http')) {
            faviconUrl = `${baseUrl}/${faviconUrl}`
          }
          return faviconUrl
        }
      }
    } catch {
      // Failed to fetch HTML
    }

    return null
  } catch (error) {
    console.error('Error getting favicon:', error)
    return null
  }
}

/**
 * Extract logo/profile image from website using Firecrawl extract API
 * Tries to get logo URL from structured data extraction
 */
export async function extractLogoFromWebsite(
  websiteUrl: string,
  apiKey: string
): Promise<string | null> {
  if (!websiteUrl) return null

  try {
    const FIRECRAWL_API_BASE_URL = 'https://api.firecrawl.dev'
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`

    // Use Firecrawl extract API with logo in schema
    const response = await fetch(`${FIRECRAWL_API_BASE_URL}/v2/extract`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        schema: {
          logo_url: 'string',
          profile_picture: 'string',
          favicon: 'string',
        },
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const extracted = data.data || {}

    // Try logo_url first, then profile_picture, then favicon
    const logoUrl = extracted.logo_url || extracted.profile_picture || extracted.favicon

    if (logoUrl && typeof logoUrl === 'string') {
      let imageUrl = logoUrl.trim()
      // Make absolute URL if relative
      if (imageUrl.startsWith('/')) {
        const baseUrl = new URL(url).origin
        imageUrl = `${baseUrl}${imageUrl}`
      } else if (!imageUrl.startsWith('http')) {
        const baseUrl = new URL(url).origin
        imageUrl = `${baseUrl}/${imageUrl}`
      }
      return imageUrl
    }

    return null
  } catch (error) {
    console.error('Error extracting logo from website:', error)
    return null
  }
}

/**
 * Get profile picture or favicon for a website
 * Tries logo first, then falls back to favicon
 */
export async function getProfilePictureOrFavicon(
  websiteUrl: string | null,
  apiKey?: string
): Promise<string | null> {
  if (!websiteUrl) return null

  // First try to get a logo/profile image using Firecrawl
  if (apiKey) {
    const logo = await extractLogoFromWebsite(websiteUrl, apiKey)
    if (logo) {
      return logo
    }
  }

  // Fall back to favicon
  const favicon = await getFaviconUrl(websiteUrl)
  return favicon
}







