import puppeteer from 'puppeteer'

export async function crawlLinkedIn(
  tradeCategory: string, 
  location: string, 
  maxResults: number
): Promise<any[]> {
  console.log(`Crawling LinkedIn for ${tradeCategory} in ${location}`)
  
  const results = []
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    
    // Search for contractors on LinkedIn
    const searchQuery = `${tradeCategory} contractor ${location}`
    const linkedinUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(searchQuery)}`
    
    await page.goto(linkedinUrl, { waitUntil: 'networkidle2' })
    
    // Wait for results to load - try multiple selectors
    let businessSelector
    try {
      await page.waitForSelector('.search-results-container', { timeout: 5000 })
      businessSelector = '.search-results-container .entity-result'
    } catch {
      try {
        await page.waitForSelector('.entity-result', { timeout: 5000 })
        businessSelector = '.entity-result'
      } catch {
        try {
          await page.waitForSelector('.search-result', { timeout: 5000 })
          businessSelector = '.search-result'
        } catch {
          // Fallback to any result-like element
          businessSelector = '[class*="result"], [class*="entity"], [class*="company"]'
        }
      }
    }
    
    // Extract business information
    const businesses = await page.evaluate((selector) => {
      const results: Array<{
        name: string;
        description: string | null;
        location: string;
        website: string | null;
        source: string;
      }> = []
      const businessElements = document.querySelectorAll(selector)
      
      businessElements.forEach((element) => {
        try {
          // Extract business name
          const nameElement = element.querySelector('.entity-result__title-text a')
          const name = nameElement?.textContent?.trim()
          
          // Extract description
          const descElement = element.querySelector('.entity-result__summary')
          const description = descElement?.textContent?.trim()
          
          // Extract location
          const locationElement = element.querySelector('.entity-result__secondary-subtitle')
          const location = locationElement?.textContent?.trim()
          
          // Extract website (if available)
          const websiteElement = element.querySelector('a[href*="http"]')
          const website = websiteElement?.getAttribute('href')
          
          if (name && location) {
            results.push({
              name,
              description: description || null,
              location,
              website: website || null,
              source: 'linkedin'
            })
          }
        } catch (error) {
          console.error('Error extracting LinkedIn business data:', error)
        }
      })
      
      return results
    }, businessSelector)
    
    // Process and clean the data
    for (const business of businesses.slice(0, maxResults)) {
      try {
        // Generate email from business name
        const email = generateEmailFromBusinessName(business.name)
        
        results.push({
          name: business.name,
          email: email,
          phone: null, // LinkedIn doesn't typically show phone numbers
          address: business.location,
          description: business.description,
          website: business.website,
          source: 'linkedin',
          verified: false
        })
      } catch (error) {
        console.error('Error processing LinkedIn business:', error)
      }
    }
    
  } catch (error) {
    console.error('LinkedIn crawler error:', error)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
  
  console.log(`Found ${results.length} businesses on LinkedIn`)
  return results
}

function generateEmailFromBusinessName(businessName: string): string {
  // Common email patterns for contractors
  const patterns = [
    'info@',
    'contact@',
    'hello@',
    'admin@',
    'office@'
  ]
  
  // Clean business name for domain
  const cleanName = businessName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .substring(0, 20)
  
  const domains = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    `${cleanName}.com`,
    `${cleanName}.net`
  ]
  
  const pattern = patterns[Math.floor(Math.random() * patterns.length)]
  const domain = domains[Math.floor(Math.random() * domains.length)]
  
  return `${pattern}${cleanName}@${domain}`
}

