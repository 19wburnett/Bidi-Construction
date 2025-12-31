import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function crawlYellowPages(
  tradeCategory: string, 
  location: string, 
  maxResults: number
): Promise<any[]> {
  console.log(`Crawling Yellow Pages for ${tradeCategory} in ${location}`)
  
  const results = []
  let browser
  
  try {
    // Use serverless-compatible Chromium in production, regular Puppeteer in development
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
    
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    }
    
    // Use Chromium binary for serverless environments
    if (isProduction) {
      launchOptions.executablePath = await chromium.executablePath()
    }
    
    browser = await puppeteer.launch(launchOptions)
    
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    
    // Search for contractors on Yellow Pages
    const searchQuery = `${tradeCategory} contractor`
    const locationQuery = location.replace(/\s+/g, '-').toLowerCase()
    const yellowPagesUrl = `https://www.yellowpages.com/${locationQuery}/${searchQuery.replace(/\s+/g, '-')}`
    
    await page.goto(yellowPagesUrl, { waitUntil: 'networkidle2' })
    
    // Wait for results to load
    await page.waitForSelector('body', { timeout: 10000 })
    
    // Extract business information
    const businesses = await page.evaluate(() => {
      const results: Array<{
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        website: string | null;
        source: string;
      }> = []
      
      // Try multiple selectors for Yellow Pages
      const selectors = [
        '.result',
        '.business-listing',
        '.listing',
        '.v-card',
        '.info',
        '[data-testid="serp-ia-card"]'
      ]
      
      let businessElements: Element[] = []
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector)
        if (elements.length > 0) {
          businessElements = Array.from(elements)
          break
        }
      }
      
      // Fallback to any element with business-like content
      if (businessElements.length === 0) {
        businessElements = Array.from(document.querySelectorAll('div, li')).filter(el => {
          const text = el.textContent?.toLowerCase() || ''
          return text.includes('contractor') || text.includes('construction') || text.includes('services') || text.includes('phone')
        })
      }
      
      businessElements.forEach((element) => {
        try {
          const text = element.textContent || ''
          
          // Extract business name (look for common patterns)
          const namePatterns = [
            /^([A-Z][a-zA-Z\s&,.-]+?)(?:\s*-\s*|\s*\(|\s*$)/,
            /^([A-Z][a-zA-Z\s&,.-]+?)(?:\s*Contractor|\s*Construction|\s*Services)/,
            /^([A-Z][a-zA-Z\s&,.-]+?)(?:\s*Inc\.|\s*LLC|\s*Corp\.)/
          ]
          
          let name = null
          for (const pattern of namePatterns) {
            const match = text.match(pattern)
            if (match && match[1]) {
              name = match[1].trim()
              break
            }
          }
          
          // If no pattern matched, try to extract first line as name
          if (!name) {
            const lines = text.split('\n').filter(line => line.trim().length > 0)
            if (lines.length > 0) {
              // Clean up the first line to get just the business name
              let firstLine = lines[0].trim()
              
              // Remove common suffixes that indicate this isn't the business name
              firstLine = firstLine.replace(/\s*(Painting Contractors?|Contractors?|Construction|Services?|LLC|Inc\.|Corp\.).*$/i, '')
              
              // Remove any leading numbers or special characters
              firstLine = firstLine.replace(/^[\d\s\.-]+/, '')
              
              // Limit length and clean up
              name = firstLine.substring(0, 50).trim()
            }
          }
          
          // Final cleanup of the name
          if (name) {
            // Remove any remaining unwanted text
            name = name.replace(/\s*(Painting Contractors?|Contractors?|Construction|Services?|LLC|Inc\.|Corp\.).*$/i, '')
            name = name.replace(/^[\d\s\.-]+/, '') // Remove leading numbers
            name = name.trim()
          }
          
          // Extract phone number
          const phoneMatch = text.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)
          const phone = phoneMatch ? phoneMatch[1] : null
          
          // Extract email
          const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
          const email = emailMatch ? emailMatch[1] : null
          
          // Extract website URL
          let website = null
          const websiteLink = element.querySelector('a[href*="http"]')
          if (websiteLink) {
            const href = websiteLink.getAttribute('href')
            if (href && !href.includes('yellowpages.com') && !href.includes('facebook.com') && !href.includes('twitter.com')) {
              website = href
            }
          }
          
          // Extract address (look for common address patterns)
          const addressMatch = text.match(/(\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Court|Ct))/)
          const address = addressMatch ? addressMatch[1] : null
          
          if (name && (phone || email || website)) {
            results.push({
              name,
              email: email || null,
              phone: phone || null,
              address: address || null,
              website: website || null,
              source: 'yellow_pages'
            })
          }
        } catch (error) {
          console.error('Error extracting Yellow Pages business data:', error)
        }
      })
      
      return results
    })
    
    // Process and clean the data, visiting individual profiles for better contact info
    for (let i = 0; i < Math.min(businesses.length, maxResults); i++) {
      const business = businesses[i]
      try {
        let enhancedBusiness = { ...business }
        
        // If we have a website, try to get more contact info from the business profile
        if (business.website || business.name) {
          try {
            const profileInfo = await extractBusinessProfileInfo(page, business)
            if (profileInfo) {
              enhancedBusiness = { ...enhancedBusiness, ...profileInfo }
            }
            
            // Add delay between profile visits to be respectful
            if (i < Math.min(businesses.length, maxResults) - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
            }
          } catch (error) {
            console.log(`Could not extract profile info for ${business.name}:`, error)
          }
        }
        
        // Include contractors that have any contact information (email, website, or phone)
        if (enhancedBusiness.email || enhancedBusiness.website || enhancedBusiness.phone) {
          // Generate email from website domain if we have a website but no email
          let email = enhancedBusiness.email
          if (!email && enhancedBusiness.website) {
            email = generateEmailFromWebsite(enhancedBusiness.website)
          }
          
          // If still no email, generate one from business name (but mark as unverified)
          if (!email) {
            email = generateEmailFromBusinessName(enhancedBusiness.name)
          }
          
          results.push({
            name: enhancedBusiness.name,
            email: email,
            phone: enhancedBusiness.phone,
            address: enhancedBusiness.address,
            website: enhancedBusiness.website,
            source: 'yellow_pages',
            verified: !!enhancedBusiness.email // Mark as verified if we found a real email
          })
        } else {
          console.log(`Skipping ${enhancedBusiness.name} - no contact information found`)
        }
      } catch (error) {
        console.error('Error processing Yellow Pages business:', error)
      }
    }
    
  } catch (error) {
    console.error('Yellow Pages crawler error:', error)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
  
  console.log(`Found ${results.length} businesses on Yellow Pages`)
  return results
}

async function extractBusinessProfileInfo(page: any, business: any): Promise<any> {
  try {
    // Look for business profile link in the current page
    const profileLink = await page.evaluate((businessName: string) => {
      // Try to find a link to the business profile
      const links = Array.from(document.querySelectorAll('a'))
      
      // First, try to find links that clearly indicate business profiles
      let profileLink = links.find(link => {
        const href = link.getAttribute('href')
        return href && (
          href.includes('/biz/') || 
          href.includes('/business/') ||
          href.includes('/profile/') ||
          href.includes('/listing/')
        )
      })
      
      // If no clear profile link, look for business name links
      if (!profileLink) {
        profileLink = links.find(link => {
          const href = link.getAttribute('href')
          const text = link.textContent?.toLowerCase() || ''
          return href && 
            text.includes(businessName.toLowerCase()) &&
            !href.includes('mailto:') &&
            !href.includes('tel:') &&
            !href.includes('http') // Look for relative links
        })
      }
      
      // Fallback: look for any link within business listing containers
      if (!profileLink) {
        const businessContainers = document.querySelectorAll('.result, .business-listing, .listing, .v-card, .info, [data-testid="serp-ia-card"]')
        for (const container of Array.from(businessContainers)) {
          const containerText = container.textContent?.toLowerCase() || ''
          if (containerText.includes(businessName.toLowerCase())) {
            const containerLink = container.querySelector('a[href]:not([href*="mailto"]):not([href*="tel"])') as HTMLAnchorElement
            if (containerLink) {
              profileLink = containerLink
              break
            }
          }
        }
      }
      
      return profileLink ? profileLink.getAttribute('href') : null
    }, business.name)

    if (!profileLink) {
      return null
    }

    // Navigate to the business profile
    const fullProfileUrl = profileLink.startsWith('http') ? profileLink : `https://www.yellowpages.com${profileLink}`
    console.log(`Visiting business profile: ${fullProfileUrl}`)
    
    await page.goto(fullProfileUrl, { waitUntil: 'networkidle2', timeout: 10000 })
    
    // Extract contact information from the profile page
    const profileData = await page.evaluate(() => {
      const result: any = {}
      
      // Extract email from mailto links
      const emailLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'))
      if (emailLinks.length > 0) {
        const emailHref = emailLinks[0].getAttribute('href')
        if (emailHref) {
          result.email = emailHref.replace('mailto:', '').split('?')[0] // Remove mailto: and any query params
        }
      }
      
      // Extract phone number (look for more specific selectors on profile page)
      const phoneSelectors = [
        '.phone',
        '.phone-number',
        '.contact-phone',
        '[data-testid="phone"]',
        'a[href^="tel:"]'
      ]
      
      for (const selector of phoneSelectors) {
        const phoneElement = document.querySelector(selector)
        if (phoneElement) {
          const phoneText = phoneElement.textContent || phoneElement.getAttribute('href')
          if (phoneText) {
            const phoneMatch = phoneText.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)
            if (phoneMatch) {
              result.phone = phoneMatch[1]
              break
            }
          }
        }
      }
      
      // Extract website URL
      const websiteSelectors = [
        'a[href*="http"]:not([href*="yellowpages.com"]):not([href*="facebook.com"]):not([href*="twitter.com"])',
        '.website',
        '.website-link',
        '.business-website'
      ]
      
      for (const selector of websiteSelectors) {
        const websiteElement = document.querySelector(selector)
        if (websiteElement) {
          const href = websiteElement.getAttribute('href')
          if (href && !href.includes('yellowpages.com') && !href.includes('facebook.com') && !href.includes('twitter.com')) {
            result.website = href
            break
          }
        }
      }
      
      // Extract address
      const addressSelectors = [
        '.address',
        '.business-address',
        '.location',
        '[data-testid="address"]'
      ]
      
      for (const selector of addressSelectors) {
        const addressElement = document.querySelector(selector)
        if (addressElement) {
          const addressText = addressElement.textContent?.trim()
          if (addressText && addressText.length > 10) {
            result.address = addressText
            break
          }
        }
      }
      
      return result
    })
    
    console.log(`Extracted profile data:`, profileData)
    return profileData
    
  } catch (error) {
    console.error('Error extracting business profile info:', error)
    return null
  }
}

function generateEmailFromWebsite(website: string): string | null {
  try {
    // Extract domain from website URL
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    const domain = url.hostname.replace('www.', '')
    
    // Common email patterns for contractors
    const patterns = ['info@', 'contact@', 'hello@', 'admin@', 'office@']
    const pattern = patterns[Math.floor(Math.random() * patterns.length)]
    
    return `${pattern}${domain}`
  } catch (error) {
    console.log(`Could not generate email from website: ${website}`)
    return null
  }
}

function generateEmailFromBusinessName(businessName: string): string {
  // Clean business name for email generation
  const cleanName = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, 15) // Shorter to avoid long emails
  
  // Use common domains for contractors
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']
  const domain = domains[Math.floor(Math.random() * domains.length)]
  
  // Just use the clean name with the domain, no prefix
  return `${cleanName}@${domain}`
}

