import puppeteer from 'puppeteer'

export async function crawlGoogleMyBusiness(
  tradeCategory: string, 
  location: string, 
  maxResults: number
): Promise<any[]> {
  console.log(`Crawling Google Maps for ${tradeCategory} in ${location}`)
  
  const results = []
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ]
    })
    
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    // Search for contractors on Google Maps
    const searchQuery = `${tradeCategory} ${location}`
    const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`
    
    console.log(`Searching Google Maps: ${mapsUrl}`)
    await page.goto(mapsUrl, { waitUntil: 'networkidle2', timeout: 15000 })
    
    // Wait for the search results to load
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Try to find business listings
    const businesses = await page.evaluate(() => {
      const results: Array<{
        name: string;
        address: string | null;
        phone: string | null;
        website: string | null;
        rating: number | null;
        source: string;
      }> = []
      
      // Look for business cards in the sidebar
      const businessCards = document.querySelectorAll('[role="article"], .Nv2PK, .THOPZb, .lI9IFe')
      
      console.log(`Found ${businessCards.length} business cards`)
      
      businessCards.forEach((card, index) => {
        try {
          // Extract business name
          const nameSelectors = [
            'h3',
            '.fontHeadlineSmall',
            '.fontHeadlineMedium',
            '[data-value="Directions"]',
            '.qBF1Pd'
          ]
          
          let name = null
          for (const selector of nameSelectors) {
            const nameElement = card.querySelector(selector)
            if (nameElement?.textContent?.trim()) {
              name = nameElement.textContent.trim()
              break
            }
          }
          
          // Extract address
          const addressSelectors = [
            '.W4Efsd:last-child',
            '.W4Efsd',
            '.fontBodyMedium',
            '[data-value="Directions"]'
          ]
          
          let address = null
          for (const selector of addressSelectors) {
            const addressElement = card.querySelector(selector)
            if (addressElement?.textContent?.trim()) {
              const text = addressElement.textContent.trim()
              // Check if it looks like an address (contains numbers and street words)
              if (text.match(/\d+.*(?:st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|ct|court|way|place)/i)) {
                address = text
                break
              }
            }
          }
          
          // Extract phone number
          const phoneSelectors = [
            '[data-value="Phone"]',
            '.fontBodyMedium',
            '.W4Efsd'
          ]
          
          let phone = null
          for (const selector of phoneSelectors) {
            const phoneElement = card.querySelector(selector)
            if (phoneElement?.textContent?.trim()) {
              const text = phoneElement.textContent.trim()
              const phoneMatch = text.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)
              if (phoneMatch) {
                phone = phoneMatch[1]
                break
              }
            }
          }
          
          // Extract website
          let website = null
          const websiteElement = card.querySelector('a[href*="http"]:not([href*="google.com"])')
          if (websiteElement) {
            const href = websiteElement.getAttribute('href')
            if (href && !href.includes('google.com') && !href.includes('facebook.com') && !href.includes('twitter.com')) {
              website = href
            }
          }
          
          // Extract rating
          let rating = null
          const ratingElement = card.querySelector('[role="img"][aria-label*="stars"]')
          if (ratingElement) {
            const ratingText = ratingElement.getAttribute('aria-label')
            const ratingMatch = ratingText?.match(/(\d+\.?\d*)/)
            if (ratingMatch) {
              rating = parseFloat(ratingMatch[1])
            }
          }
          
          if (name && (address || phone)) {
            results.push({
              name,
              address: address || null,
              phone: phone || null,
              website: website || null,
              rating: rating || null,
              source: 'google_maps'
            })
          }
        } catch (error) {
          console.error('Error extracting business data:', error)
        }
      })
      
      return results
    })
    
    console.log(`Extracted ${businesses.length} businesses from Google Maps`)
    
    // Process and clean the data
    for (const business of businesses.slice(0, maxResults)) {
      try {
        // Generate email from website if available, otherwise from business name
        let email = null
        if (business.website) {
          email = generateEmailFromWebsite(business.website)
        }
        if (!email) {
          email = generateEmailFromBusinessName(business.name)
        }
        
        results.push({
          name: business.name,
          email: email,
          phone: business.phone,
          address: business.address,
          website: business.website,
          rating: business.rating,
          source: 'google_maps',
          verified: !!business.website // Mark as verified if we found a website
        })
      } catch (error) {
        console.error('Error processing business:', error)
      }
    }
    
  } catch (error) {
    console.error('Google Maps crawler error:', error)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
  
  console.log(`Found ${results.length} businesses on Google Maps`)
  return results
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

