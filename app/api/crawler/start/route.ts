import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Use Node.js runtime for Supabase compatibility
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    console.log('Crawler start endpoint called')
    
    const body = await request.json()
    console.log('Request body:', body)
    
    const { 
      trade_category, 
      location, 
      max_results = 50,
      search_radius = 25 // miles
    } = body

    if (!trade_category || !location) {
      console.log('Missing required fields:', { trade_category, location })
      return NextResponse.json(
        { error: 'Trade category and location are required' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Get the current user from the session
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', authUser.id)
      .single()

    if (userError || !user?.is_admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Create crawler job record
    const { data: crawlerJob, error: jobError } = await supabase
      .from('crawler_jobs')
      .insert({
        trade_category: trade_category,
        location,
        max_results: max_results,
        search_radius: search_radius,
        status: 'running',
        created_by: authUser.id
      })
      .select()
      .single()

    if (jobError) {
      console.error('Error creating crawler job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create crawler job' },
        { status: 500 }
      )
    }

    // Start the crawler process asynchronously
    startCrawlerProcess({
      tradeCategory: trade_category,
      location,
      maxResults: max_results,
      searchRadius: search_radius,
      crawlerJobId: crawlerJob.id
    })

    return NextResponse.json({
      message: 'Crawler started successfully',
      jobId: crawlerJob.id,
      tradeCategory: trade_category,
      location,
      maxResults: max_results,
      searchRadius: search_radius
    })
  } catch (error) {
    console.error('Error starting crawler:', error)
    return NextResponse.json(
      { 
        error: 'Failed to start crawler',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function startCrawlerProcess({
  tradeCategory,
  location,
  maxResults,
  searchRadius,
  crawlerJobId
}: {
  tradeCategory: string
  location: string
  maxResults: number
  searchRadius: number
  crawlerJobId: string
}) {
  console.log(`Starting crawler for ${tradeCategory} in ${location}`)
  
  try {
    // Import the crawler modules
    const { crawlGoogleMyBusiness } = await import('@/lib/crawlers/google-my-business')
    const { crawlYellowPages } = await import('@/lib/crawlers/yellow-pages')
    
    const results = []
    
    // Run crawlers in parallel with rate limiting
    const crawlers = [
      crawlGoogleMyBusiness(tradeCategory, location, Math.floor(maxResults * 0.7)), // Google Maps should find the most results
      crawlYellowPages(tradeCategory, location, Math.floor(maxResults * 0.3)) // Yellow Pages as backup
    ]

    // Execute crawlers with delays to avoid rate limiting
    for (let i = 0; i < crawlers.length; i++) {
      try {
        const crawlerResults = await crawlers[i]
        results.push(...crawlerResults)
        
        // Add delay between crawlers
        if (i < crawlers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
        }
      } catch (error) {
        console.error(`Crawler ${i} failed:`, error)
      }
    }

    // Process and validate results
    const validatedResults = await validateAndProcessResults(results, tradeCategory, location)
    
    // Extract contact info from websites
    const enhancedResults = await enhanceResultsWithWebsiteScraping(validatedResults)
    
    // Store results in database
    await storeCrawlerResults(enhancedResults, crawlerJobId)
    
    // Send outreach emails
    const emailsSent = await sendOutreachEmails(enhancedResults, tradeCategory, location)
    
    console.log(`Crawler completed: Found ${enhancedResults.length} contractors, sent ${emailsSent} emails`)
    
    // Update crawler job status to completed
    const supabase = await createServerSupabaseClient()
    await supabase
      .from('crawler_jobs')
      .update({
        status: 'completed',
        results_found: enhancedResults.length,
        emails_sent: emailsSent,
        completed_at: new Date().toISOString()
      })
      .eq('id', crawlerJobId)
    
  } catch (error) {
    console.error('Crawler process failed:', error)
    
    // Update crawler job status to failed
    try {
      const supabase = await createServerSupabaseClient()
      await supabase
        .from('crawler_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', crawlerJobId)
    } catch (updateError) {
      console.error('Error updating crawler job status:', updateError)
    }
  }
}

async function enhanceResultsWithWebsiteScraping(results: any[]) {
  const { scrapeMultipleWebsites } = await import('@/lib/crawlers/website-scraper')
  
  // Get all unique websites from results
  const websites = Array.from(new Set(results.map(r => r.website).filter(Boolean)))
  
  if (websites.length === 0) {
    console.log('No websites found to scrape')
    return results
  }
  
  console.log(`Scraping ${websites.length} websites for contact information`)
  
  try {
    // Scrape websites for contact info
    const contactInfos = await scrapeMultipleWebsites(websites)
    
    // Create a map of website to contact info
    const websiteContactMap = new Map()
    contactInfos.forEach((contactInfo, index) => {
      if (contactInfo.website) {
        websiteContactMap.set(contactInfo.website, contactInfo)
      }
    })
    
    // Enhance results with scraped contact info
    const enhancedResults = results.map(result => {
      if (result.website && websiteContactMap.has(result.website)) {
        const contactInfo = websiteContactMap.get(result.website)
        
        return {
          ...result,
          // Use scraped email if available and valid, otherwise keep original
          email: contactInfo.email && isValidEmail(contactInfo.email) ? contactInfo.email : result.email,
          // Use scraped phone if available, otherwise keep original
          phone: contactInfo.phone || result.phone,
          // Keep the website
          website: result.website
        }
      }
      
      return result
    })
    
    console.log(`Enhanced ${enhancedResults.length} results with website scraping`)
    return enhancedResults
    
  } catch (error) {
    console.error('Error enhancing results with website scraping:', error)
    return results // Return original results if scraping fails
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

async function validateAndProcessResults(results: any[], tradeCategory: string, location: string) {
  const supabase = await createServerSupabaseClient()
  
  const validatedResults = []
  
  for (const contractor of results) {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(contractor.email)) {
        console.log(`Invalid email for ${contractor.name}: ${contractor.email}`)
        continue
      }

      // Check if contractor already exists
      const { data: existing } = await supabase
        .from('subcontractors')
        .select('id')
        .eq('email', contractor.email)
        .single()

      if (existing) {
        console.log(`Contractor already exists: ${contractor.email}`)
        continue
      }

      // Validate business name
      if (!contractor.name || contractor.name.length < 2) {
        continue
      }

      // Validate phone number (basic check)
      if (contractor.phone && !/^[\d\s\-\+\(\)]+$/.test(contractor.phone)) {
        contractor.phone = null
      }

      validatedResults.push({
        ...contractor,
        trade_category: tradeCategory,
        location: location,
        source: contractor.source || 'web_crawler',
        verified: false,
        created_at: new Date().toISOString()
      })
      
    } catch (error) {
      console.error(`Error validating contractor ${contractor.name}:`, error)
    }
  }
  
  return validatedResults
}

async function storeCrawlerResults(results: any[], crawlerJobId: string) {
  const supabase = await createServerSupabaseClient()
  
  try {
    // Transform results to match crawler_discovered_contractors schema
    const contractorsToInsert = results.map(contractor => ({
      crawler_job_id: crawlerJobId,
      name: contractor.name,
      email: contractor.email,
      phone: contractor.phone,
      address: contractor.address,
      website: contractor.website,
      rating: contractor.rating,
      source: contractor.source,
      verified: contractor.verified || false
    }))

    const { error } = await supabase
      .from('crawler_discovered_contractors')
      .insert(contractorsToInsert)

    if (error) {
      console.error('Error storing crawler results:', error)
    } else {
      console.log(`Stored ${results.length} contractors in database`)
    }
  } catch (error) {
    console.error('Error storing results:', error)
  }
}

async function sendOutreachEmails(results: any[], tradeCategory: string, location: string): Promise<number> {
  const supabase = await createServerSupabaseClient()
  
  // Get email template
  const emailTemplate = await getOutreachEmailTemplate(tradeCategory, location)
  
  let emailsSent = 0
  
  for (let i = 0; i < results.length; i++) {
    const contractor = results[i]
    try {
      // Check if we've already sent an email to this contractor
      const { data: existingOutreach } = await supabase
        .from('crawler_outreach_log')
        .select('id')
        .eq('contractor_email', contractor.email)
        .single()
      
      if (existingOutreach) {
        console.log(`Skipping ${contractor.email} - already sent outreach email`)
        continue
      }
      
      // Send outreach email
      await sendOutreachEmail(contractor, emailTemplate)
      
      // Log the outreach
      await supabase
        .from('crawler_outreach_log')
        .insert({
          contractor_email: contractor.email,
          contractor_name: contractor.name,
          trade_category: tradeCategory,
          location: location,
          sent_at: new Date().toISOString(),
          status: 'sent'
        })
        
      console.log(`Sent outreach email to ${contractor.email}`)
      emailsSent++
        
      // Add delay between emails to avoid rate limiting (Resend allows 2 requests per second)
      if (i < results.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 600)) // 600ms delay = ~1.67 requests per second
      }
        
    } catch (error) {
      console.error(`Error sending outreach to ${contractor.email}:`, error)
    }
  }
  
  return emailsSent
}

async function getOutreachEmailTemplate(tradeCategory: string, location: string) {
  return {
    subject: `Join Bidi - New ${tradeCategory} Opportunities in ${location}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Bidi</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Construction Marketplace</p>
        </div>
        
        <div style="padding: 30px; background-color: #f8fafc;">
          <h2 style="color: #1e293b; margin-bottom: 20px;">Join Bidi and Get More ${tradeCategory} Jobs</h2>
          
          <p>Hi there,</p>
          
          <p>We found your ${tradeCategory} business and thought you might be interested in joining Bidi, a new construction marketplace that connects contractors with general contractors in ${location}.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #3b82f6; margin-top: 0;">Why Join Bidi?</h3>
            <ul style="line-height: 1.6;">
              <li><strong>More Jobs:</strong> Get notified about ${tradeCategory} projects in your area</li>
              <li><strong>Easy Bidding:</strong> Submit bids directly through email</li>
              <li><strong>No Fees:</strong> It's completely free to join and bid</li>
              <li><strong>Quality Projects:</strong> Work with verified general contractors</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://savewithbidi.com/subcontractors" 
               style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Join Bidi Now
            </a>
          </div>
          
          <p style="font-size: 14px; color: #64748b;">
            If you're not interested, you can simply ignore this email. We won't contact you again.
          </p>
        </div>
        
        <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0; font-size: 14px;">
            © 2024 Bidi. All rights reserved.
          </p>
        </div>
      </div>
    `
  }
}

async function sendOutreachEmail(contractor: any, template: any) {
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    
    const { data, error } = await resend.emails.send({
      from: 'Bidi <noreply@savewithbidi.com>',
      to: [contractor.email],
      subject: template.subject,
      html: template.html,
    })

    if (error) {
      console.error(`Failed to send email to ${contractor.email}:`, error)
      return { success: false, error }
    }

    console.log(`Email sent successfully to ${contractor.email}:`, data)
    return { success: true, data }
  } catch (error) {
    console.error(`Error sending email to ${contractor.email}:`, error)
    return { success: false, error }
  }
}

