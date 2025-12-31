import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

export async function crawlYelp(
  tradeCategory: string, 
  location: string, 
  maxResults: number
): Promise<any[]> {
  console.log(`Crawling Yelp for ${tradeCategory} in ${location}`)
  
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
    
    // Search for contractors on Yelp
    const searchQuery = `${tradeCategory} contractor`
    const yelpUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(searchQuery)}&find_loc=${encodeURIComponent(location)}`
    
    await page.goto(yelpUrl, { waitUntil: 'networkidle2' })
    
    // Wait for results to load - try multiple selectors
    let businessElements
    try {
      await page.waitForSelector('[data-testid="serp-ia-card"]', { timeout: 5000 })
      businessElements = '[data-testid="serp-ia-card"]'
    } catch {
      try {
        await page.waitForSelector('.biz-listing-large', { timeout: 5000 })
        businessElements = '.biz-listing-large'
      } catch {
        try {
          await page.waitForSelector('[data-testid="business-card"]', { timeout: 5000 })
          businessElements = '[data-testid="business-card"]'
        } catch {
          // Fallback to any business-like element
          businessElements = '.biz-listing, .business-card, [class*="business"], [class*="listing"]'
        }
      }
    }
    
    // Extract business information
    const businesses = await page.evaluate((selector) => {
      const results: Array<{
        name: string;
        address: string;
        phone: string | null;
        rating: number | null;
        website: string | null;
        source: string;
      }> = []
      const elements = document.querySelectorAll(selector)
      
      elements.forEach((element) => {
        try {
          // Extract business name
          const nameElement = element.querySelector('h3 a')
          const name = nameElement?.textContent?.trim()
          
          // Extract rating
          const ratingElement = element.querySelector('[aria-label*="star"]')
          const rating = ratingElement?.getAttribute('aria-label')?.match(/(\d+\.?\d*)/)?.[1]
          
          // Extract address
          const addressElement = element.querySelector('[data-testid="address"]')
          const address = addressElement?.textContent?.trim()
          
          // Extract phone
          const phoneElement = element.querySelector('[data-testid="phone"]')
          const phone = phoneElement?.textContent?.trim()
          
          // Extract website (if available)
          const websiteElement = element.querySelector('a[href*="biz"]')
          const website = websiteElement?.getAttribute('href')
          
          if (name && address) {
            results.push({
              name,
              address,
              phone: phone || null,
              rating: rating ? parseFloat(rating) : null,
              website: website || null,
              source: 'yelp'
            })
          }
        } catch (error) {
          console.error('Error extracting Yelp business data:', error)
        }
      })
      
      return results
    }, businessElements)
    
    // Process and clean the data
    for (const business of businesses.slice(0, maxResults)) {
      try {
        // Generate email from business name
        const email = generateEmailFromBusinessName(business.name)
        
        results.push({
          name: business.name,
          email: email,
          phone: business.phone,
          address: business.address,
          rating: business.rating,
          website: business.website,
          source: 'yelp',
          verified: false
        })
      } catch (error) {
        console.error('Error processing Yelp business:', error)
      }
    }
    
  } catch (error) {
    console.error('Yelp crawler error:', error)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
  
  console.log(`Found ${results.length} businesses on Yelp`)
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

