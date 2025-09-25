import puppeteer from 'puppeteer'

export interface ContactInfo {
  email?: string
  phone?: string
  website?: string
}

export async function scrapeWebsiteForContactInfo(website: string): Promise<ContactInfo> {
  if (!website) {
    return {}
  }

  // Ensure website has protocol
  if (!website.startsWith('http://') && !website.startsWith('https://')) {
    website = 'https://' + website
  }

  let browser
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--no-first-run',
        '--single-process'
      ]
    })
    
    const page = await browser.newPage()
    
    // Set user agent to avoid blocking
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
    
    // Set timeout
    await page.setDefaultTimeout(12000)
    await page.setDefaultNavigationTimeout(12000)
    
    console.log(`Scraping website: ${website}`)
    
    try {
      await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 10000 })
    } catch (error) {
      console.log(`Failed to load ${website}:`, error instanceof Error ? error.message : String(error))
      // Try with a shorter timeout and different wait condition
      try {
        await page.goto(website, { waitUntil: 'domcontentloaded', timeout: 6000 })
      } catch (retryError) {
        console.log(`Retry failed for ${website}:`, retryError instanceof Error ? retryError.message : String(retryError))
        return { website }
      }
    }
    
    // Get page content
    const content = await page.content()
    
    // Extract contact information
    const contactInfo: ContactInfo = { website }
    
    // Extract emails
    const emailMatches = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
    if (emailMatches) {
      // Filter out common non-contact emails
      const contactEmails = emailMatches.filter((email: string) => {
        const lowerEmail = email.toLowerCase()
        return !lowerEmail.includes('noreply') && 
               !lowerEmail.includes('no-reply') &&
               !lowerEmail.includes('donotreply') &&
               !lowerEmail.includes('example') &&
               !lowerEmail.includes('test') &&
               !lowerEmail.includes('admin') &&
               !lowerEmail.includes('webmaster') &&
               !lowerEmail.includes('postmaster')
      })
      
      if (contactEmails.length > 0) {
        contactInfo.email = contactEmails[0] // Take the first valid contact email
      }
    }
    
    // Extract phone numbers
    const phoneMatches = content.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g)
    if (phoneMatches) {
      // Clean up phone numbers
      const cleanPhones = phoneMatches.map((phone: string) => {
        return phone.replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
      })
      
      if (cleanPhones.length > 0) {
        contactInfo.phone = cleanPhones[0] // Take the first phone number
      }
    }
    
    // Try to find contact page
    try {
      const contactLinks = await page.$$eval('a[href*="contact"], a[href*="about"], a[href*="info"]', (links: any[]) => 
        links.map((link: any) => (link as HTMLAnchorElement).href).slice(0, 3)
      )
      
      if (contactLinks.length > 0) {
        // Visit contact page for better contact info
        try {
          await page.goto(contactLinks[0], { waitUntil: 'networkidle2', timeout: 5000 })
          const contactContent = await page.content()
          
          // Extract emails from contact page
          const contactEmailMatches = contactContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
          if (contactEmailMatches && !contactInfo.email) {
            const contactEmails = contactEmailMatches.filter((email: string) => {
              const lowerEmail = email.toLowerCase()
              return !lowerEmail.includes('noreply') && 
                     !lowerEmail.includes('no-reply') &&
                     !lowerEmail.includes('donotreply') &&
                     !lowerEmail.includes('example') &&
                     !lowerEmail.includes('test')
            })
            
            if (contactEmails.length > 0) {
              contactInfo.email = contactEmails[0]
            }
          }
          
          // Extract phone from contact page
          const contactPhoneMatches = contactContent.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g)
          if (contactPhoneMatches && !contactInfo.phone) {
            const cleanPhones = contactPhoneMatches.map((phone: string) => {
              return phone.replace(/[^\d]/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
            })
            
            if (cleanPhones.length > 0) {
              contactInfo.phone = cleanPhones[0]
            }
          }
        } catch (error) {
          console.log(`Failed to scrape contact page: ${error}`)
        }
      }
    } catch (error) {
      console.log(`Failed to find contact links: ${error}`)
    }
    
    console.log(`Extracted contact info from ${website}:`, contactInfo)
    return contactInfo
    
  } catch (error) {
    console.error(`Error scraping website ${website}:`, error)
    return { website }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export async function scrapeMultipleWebsites(websites: string[]): Promise<ContactInfo[]> {
  const results: ContactInfo[] = []
  
  // Process websites in batches to avoid overwhelming the system
  const batchSize = 3
  for (let i = 0; i < websites.length; i += batchSize) {
    const batch = websites.slice(i, i + batchSize)
    
    const batchPromises = batch.map(website => scrapeWebsiteForContactInfo(website))
    const batchResults = await Promise.all(batchPromises)
    
    results.push(...batchResults)
    
    // Add delay between batches
    if (i + batchSize < websites.length) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay between batches
    }
  }
  
  return results
}
