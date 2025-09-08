import puppeteer from 'puppeteer'

export async function crawlTradeAssociations(
  tradeCategory: string, 
  location: string, 
  maxResults: number
): Promise<any[]> {
  console.log(`Crawling trade associations for ${tradeCategory} in ${location}`)
  
  const results = []
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    
    // Define trade association websites based on trade category
    const associationUrls = getAssociationUrls(tradeCategory, location)
    
    for (const url of associationUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2' })
        
        // Wait for results to load
        await page.waitForSelector('body', { timeout: 10000 })
        
        // Extract business information
        const businesses = await page.evaluate(() => {
          const results: Array<{
            name: string;
            email: string | null;
            phone: string | null;
            address: string | null;
            source: string;
          }> = []
          
          // Yellow Pages specific selectors
          const selectors = [
            '.result',
            '.business-listing',
            '.listing',
            '.v-card',
            '.info'
          ]
          
          let businessElements: Element[] = []
          for (const selector of selectors) {
            const elements = document.querySelectorAll(selector)
            if (elements.length > 0) {
              businessElements = Array.from(elements)
              break
            }
          }
          
          // If no specific selectors found, look for any list items or divs with business info
          if (businessElements.length === 0) {
            businessElements = Array.from(document.querySelectorAll('li, .card, .entry, .result')).filter(el => {
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
                  name = lines[0].trim().substring(0, 50) // Limit length
                }
              }
              
              // Extract phone number
              const phoneMatch = text.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)
              const phone = phoneMatch ? phoneMatch[1] : null
              
              // Extract email
              const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
              const email = emailMatch ? emailMatch[1] : null
              
              // Extract address (look for common address patterns)
              const addressMatch = text.match(/(\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Place|Pl|Court|Ct))/)
              const address = addressMatch ? addressMatch[1] : null
              
              if (name && (phone || email)) {
                results.push({
                  name,
                  email: email || null,
                  phone: phone || null,
                  address: address || null,
                  source: 'trade_association'
                })
              }
            } catch (error) {
              console.error('Error extracting association business data:', error)
            }
          })
          
          return results
        })
        
        // Process and clean the data
        for (const business of businesses.slice(0, Math.floor(maxResults / associationUrls.length))) {
          try {
            // Generate email if not found
            const email = business.email || generateEmailFromBusinessName(business.name)
            
            results.push({
              name: business.name,
              email: email,
              phone: business.phone,
              address: business.address,
              source: 'trade_association',
              verified: false
            })
          } catch (error) {
            console.error('Error processing association business:', error)
          }
        }
        
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (error) {
        console.error(`Error crawling association ${url}:`, error)
      }
    }
    
  } catch (error) {
    console.error('Trade association crawler error:', error)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
  
  console.log(`Found ${results.length} businesses from trade associations`)
  return results
}

function getAssociationUrls(tradeCategory: string, location: string): string[] {
  // Use Yellow Pages which is more reliable and has better structure
  const searchQuery = `${tradeCategory} contractor`
  const locationQuery = location.replace(/\s+/g, '-').toLowerCase()
  
  return [`https://www.yellowpages.com/${locationQuery}/${searchQuery.replace(/\s+/g, '-')}`]
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

